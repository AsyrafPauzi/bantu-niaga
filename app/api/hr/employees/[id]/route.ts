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
