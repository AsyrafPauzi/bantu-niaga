import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import {
  clockInEmployee,
  ClockEventConflictError,
  loadHrClockEvents,
} from "@/lib/hr/attendance";
import { requireHrAttendanceAccess } from "@/lib/hr/require-attendance-addon";
import { attendanceClockInSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requireHrAttendanceAccess();
  if (response) return response;

  const items = await loadHrClockEvents(user.businessId);
  return NextResponse.json({ data: items }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrAttendanceAccess();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = attendanceClockInSchema.parse(body);
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

  try {
    const item = await clockInEmployee(supabase, {
      businessId: user.businessId,
      employeeId: parsed.employee_id,
      source: "manager",
      notes: parsed.notes ?? null,
      createdBy: user.id,
    });

    await writeAuditLog(supabase, {
      businessId: user.businessId,
      actorUserId: user.id,
      action: "hr.attendance.clock_in",
      entityType: "hr_clock_events",
      entityId: item.id,
      diff: { employee_id: parsed.employee_id, source: "manager" },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof ClockEventConflictError) {
      return NextResponse.json(
        {
          error: error.code,
          message: "Employee is already clocked in.",
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
