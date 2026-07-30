import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";
import { daysUntil } from "@/lib/admin/task-compliance-schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function reminderMessage(title: string, daysBefore: number | null): string {
  if (daysBefore === null || daysBefore < 0) {
    return `"${title}" is overdue — renew as soon as possible.`;
  }
  if (daysBefore === 0) {
    return `"${title}" expires today.`;
  }
  if (daysBefore === 1) {
    return `"${title}" expires tomorrow.`;
  }
  return `"${title}" expires in ${daysBefore} days.`;
}

/** Create in-app compliance alerts for items hitting remind_days or overdue. */
export async function syncComplianceInAppAlerts(
  admin?: SupabaseClient,
): Promise<{ created: number }> {
  const client = admin ?? createServiceRoleClient();
  const noticeDate = malaysiaTodayIso();
  let created = 0;

  const { data: items, error } = await client
    .from("admin_compliance_items")
    .select("id, business_id, title, expires_on, remind_days")
    .is("deleted_at", null)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  for (const item of items ?? []) {
    const days = daysUntil(String(item.expires_on));
    const remindDays = (item.remind_days as number[] | null) ?? [30, 14, 3];
    const triggers: number[] = [];

    if (days < 0) {
      triggers.push(-1);
    } else if (remindDays.includes(days)) {
      triggers.push(days);
    }

    for (const daysBefore of triggers) {
      const message = reminderMessage(
        String(item.title),
        daysBefore < 0 ? null : daysBefore,
      );
      const { error: insertErr } = await client.from("compliance_in_app_alerts").insert({
        business_id: item.business_id,
        compliance_item_id: item.id,
        notice_date: noticeDate,
        days_before: daysBefore,
        message,
      });

      if (!insertErr) created += 1;
    }
  }

  return { created };
}
