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
import { DEFAULT_ONBOARDING_LABELS } from "@/lib/hr/employee-fields";
import { isEmployeeNumberTaken, nextEmployeeNumber } from "@/lib/hr/helpers";
import { loadHrEmployees } from "@/lib/hr/load";
import { employeeCreateSchema } from "@/lib/hr/schemas";
import { notifyHrEmployeeCreated } from "@/lib/hr/notify";
import { hrEncryptionReady } from "@/lib/hr/sensitive";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const employees = await loadHrEmployees(user.businessId);
  return NextResponse.json({ data: employees }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = employeeCreateSchema.parse(body);
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
    (parsed.identity_number && parsed.identity_number.length > 0) ||
    (parsed.bank_account_no && parsed.bank_account_no.length > 0);
  if (needsSeal && !hrEncryptionReady()) {
    return NextResponse.json(
      {
        error: "encryption_not_configured",
        message: "Sensitive HR fields require INTEGRATION_ENCRYPTION_KEY on the server.",
      },
      { status: 503 },
    );
  }

  const { apply_default_onboarding, employee_number, ...fields } = parsed;

  const supabase = await createSupabaseServerClient();

  let resolvedEmployeeNumber = employee_number?.trim() || null;
  if (!resolvedEmployeeNumber) {
    resolvedEmployeeNumber = await nextEmployeeNumber(supabase, user.businessId);
  } else if (
    await isEmployeeNumberTaken(
      supabase,
      user.businessId,
      resolvedEmployeeNumber,
    )
  ) {
    return NextResponse.json(
      {
        error: "duplicate_employee_number",
        message: "That employee number is already in use.",
      },
      { status: 400 },
    );
  }

  const insertPayload = buildEmployeeWritePayload({
    ...fields,
    employee_number: resolvedEmployeeNumber,
  } as Record<string, unknown>);
  const { data, error } = await supabase
    .from("hr_employees")
    .insert({
      ...insertPayload,
      business_id: user.businessId,
      created_by: user.id,
      annual_leave_entitlement_days: parsed.annual_leave_entitlement_days ?? 8,
    })
    .select(EMPLOYEE_DETAIL_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not create employee." },
      { status: 500 },
    );
  }

  const created = data as unknown as { id: string };

  if (apply_default_onboarding !== false) {
    await supabase.from("hr_onboarding_items").insert(
      DEFAULT_ONBOARDING_LABELS.map((label) => ({
        business_id: user.businessId,
        employee_id: created.id,
        label,
      })),
    );
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.employee.create",
    entityType: "hr_employees",
    entityId: created.id,
    diff: { full_name: parsed.full_name, role_title: parsed.role_title },
  });

  notifyHrEmployeeCreated({
    businessId: user.businessId,
    employeeId: created.id,
    fullName: parsed.full_name,
    roleTitle: parsed.role_title ?? null,
  });

  return NextResponse.json(
    { employee: mapEmployeeDetailRow(data as unknown as Record<string, unknown>) },
    { status: 201 },
  );
}
