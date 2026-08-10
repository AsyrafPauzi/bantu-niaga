import { NextResponse } from "next/server";
import { malaysiaTodayIso } from "@/lib/ai/malaysia-today";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";
import { ok } from "@/lib/api/response";
import {
  loadContractExpiringEmployees,
  loadBusinessesWithReminderPack,
} from "@/lib/hr/contract-reminders";
import { notifyHrContractExpiring } from "@/lib/hr/notify";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function alreadyNotifiedToday(
  client: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  employeeId: string,
  daysUntil: number,
  todayIso: string,
): Promise<boolean> {
  const eventType = `hr.contract.expiring_${daysUntil}`;
  const { data, error } = await client
    .from("business_notifications")
    .select("id")
    .eq("business_id", businessId)
    .eq("pillar", "hr")
    .eq("event_type", eventType)
    .contains("meta", { employee_id: employeeId, days_until: daysUntil })
    .gte("created_at", `${todayIso}T00:00:00Z`)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data != null;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  const admin = createServiceRoleClient();
  const todayIso = malaysiaTodayIso();
  let notified = 0;

  try {
    const businessIds = await loadBusinessesWithReminderPack(admin);

    for (const businessId of businessIds) {
      const expiring = await loadContractExpiringEmployees(
        admin,
        businessId,
        todayIso,
      );

      for (const employee of expiring) {
        const duplicate = await alreadyNotifiedToday(
          admin,
          businessId,
          employee.id,
          employee.daysUntil,
          todayIso,
        );
        if (duplicate) continue;

        notifyHrContractExpiring({
          businessId,
          employeeId: employee.id,
          employeeName: employee.full_name,
          contractEndDate: employee.contract_end_date,
          daysUntil: employee.daysUntil,
        });
        notified += 1;
      }
    }

    return ok({ notified, notice_date: todayIso }, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
