import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { createHrPayslip, listHrPayslips } from "@/lib/hr/payslips";
import { payslipCreateSchema } from "@/lib/hr/schemas";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";
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

export async function GET(request: Request) {
  const hrAuth = await requireHrUser();
  if (hrAuth.response) {
    const staffAuth = await requireStaffMeContext();
    if (staffAuth instanceof NextResponse) return staffAuth;
    const items = await listHrPayslips(staffAuth.user.businessId, {
      employeeId: staffAuth.employee.id,
    });
    return NextResponse.json({ data: items }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id") ?? undefined;
  const items = await listHrPayslips(hrAuth.user!.businessId, {
    employeeId,
  });
  return NextResponse.json({ data: items }, { status: 200 });
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
    parsed = payslipCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();

  try {
    const item = await createHrPayslip(supabase, {
      businessId: user!.businessId,
      employeeId: parsed.employee_id,
      month: parsed.month,
      createdBy: user!.id,
    });

    await writeAuditLog(supabase, {
      businessId: user!.businessId,
      actorUserId: user!.id,
      action: "hr.payslip.create",
      entityType: "hr_payslips",
      entityId: item.id,
      diff: {
        employee_id: parsed.employee_id,
        month: parsed.month,
        gross_myr: item.gross_myr,
        net_myr: item.net_myr,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "create_failed";
    if (code === "employee_not_found") {
      return NextResponse.json(
        { error: code, message: "Employee was not found." },
        { status: 404 },
      );
    }
    if (code === "salary_not_set") {
      return NextResponse.json(
        {
          error: code,
          message:
            "Set a base salary on the employee profile before generating a payslip.",
        },
        { status: 422 },
      );
    }
    if (code === "duplicate_period") {
      return NextResponse.json(
        {
          error: code,
          message: "A payslip already exists for this employee and month.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
