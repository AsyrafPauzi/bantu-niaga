import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrWarningLetters, createHrWarningLetter } from "@/lib/hr/warning-letters";
import { warningLetterCreateSchema } from "@/lib/hr/schemas";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return NextResponse.json(
        { error: "forbidden", reason: "hr access denied" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employee_id");
    const items = await loadHrWarningLetters(
      user.businessId,
      employeeId ?? undefined,
    );
    return NextResponse.json({ data: items }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: error.code },
        { status: 401 },
      );
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return NextResponse.json(
        { error: "forbidden", reason: "hr access denied" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = warningLetterCreateSchema.parse(body);
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
    const { data: employee } = await supabase
      .from("hr_employees")
      .select("id")
      .eq("id", parsed.employee_id)
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!employee) {
      return NextResponse.json(
        { error: "employee_not_found", message: "Employee was not found." },
        { status: 404 },
      );
    }

    const item = await createHrWarningLetter(supabase, {
      businessId: user.businessId,
      employeeId: parsed.employee_id,
      issuedAt: parsed.issued_at,
      reason: parsed.reason,
      severity: parsed.severity,
      adminFileId: parsed.admin_file_id ?? null,
      issuedBy: user.id,
    });

    await writeAuditLog(supabase, {
      businessId: user.businessId,
      actorUserId: user.id,
      action: "hr.warning_letter.create",
      entityType: "hr_warning_letters",
      entityId: item.id,
      diff: {
        employee_id: parsed.employee_id,
        severity: parsed.severity,
        issued_at: parsed.issued_at,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: error.code },
        { status: 401 },
      );
    }
    throw error;
  }
}
