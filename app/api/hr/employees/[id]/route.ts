import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  buildEmployeeWritePayload,
  EMPLOYEE_DETAIL_SELECT,
  mapEmployeeDetailRow,
} from "@/lib/hr/employee-api";
import { employeeUpdateSchema } from "@/lib/hr/schemas";
import { isEmployeeNumberTaken } from "@/lib/hr/helpers";
import { hrEncryptionReady } from "@/lib/hr/sensitive";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireHrUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = employeeUpdateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const needsSeal =
    parsed.identity_number !== undefined || parsed.bank_account_no !== undefined;
  if (needsSeal && !hrEncryptionReady()) {
    return NextResponse.json(
      {
        error: "encryption_not_configured",
        message: "Sensitive HR fields require INTEGRATION_ENCRYPTION_KEY on the server.",
      },
      { status: 503 },
    );
  }

  const updatePayload = buildEmployeeWritePayload(parsed as Record<string, unknown>);

  const supabase = await createSupabaseServerClient();

  if (parsed.user_id !== undefined) {
    if (parsed.user_id === null) {
      updatePayload.user_id = null;
    } else {
      const { data: membership } = await supabase
        .from("user_business_memberships")
        .select("user_id")
        .eq("business_id", user.businessId)
        .eq("user_id", parsed.user_id)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json(
          {
            error: "invalid_team_login",
            message: "That login is not a member of this business.",
          },
          { status: 400 },
        );
      }
      const { data: taken } = await supabase
        .from("hr_employees")
        .select("id, full_name")
        .eq("business_id", user.businessId)
        .eq("user_id", parsed.user_id)
        .neq("id", id)
        .maybeSingle();
      if (taken) {
        return NextResponse.json(
          {
            error: "team_login_already_linked",
            message: `That login is already linked to ${taken.full_name ?? "another employee"}.`,
          },
          { status: 409 },
        );
      }
      updatePayload.user_id = parsed.user_id;
    }
  }

  if (parsed.employee_number !== undefined) {
    const resolvedNumber = parsed.employee_number?.trim() || null;
    if (
      resolvedNumber &&
      (await isEmployeeNumberTaken(
        supabase,
        user.businessId,
        resolvedNumber,
        id,
      ))
    ) {
      return NextResponse.json(
        {
          error: "duplicate_employee_number",
          message: "That employee number is already in use.",
        },
        { status: 400 },
      );
    }
    updatePayload.employee_number = resolvedNumber;
  }
  const { data, error } = await supabase
    .from("hr_employees")
    .update(updatePayload)
    .eq("business_id", user.businessId)
    .eq("id", id)
    .select(EMPLOYEE_DETAIL_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: "Could not update employee." },
      { status: 500 },
    );
  }

  if (parsed.annual_leave_entitlement_days !== undefined) {
    const leaveYear = new Date().getFullYear();
    await supabase
      .from("hr_leave_balances")
      .update({ entitlement_days: parsed.annual_leave_entitlement_days })
      .eq("business_id", user.businessId)
      .eq("employee_id", id)
      .eq("leave_year", leaveYear);
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.employee.update",
    entityType: "hr_employees",
    entityId: id,
    diff: parsed as Record<string, unknown>,
  });

  return NextResponse.json(
    { employee: mapEmployeeDetailRow(data as unknown as Record<string, unknown>) },
    { status: 200 },
  );
}
