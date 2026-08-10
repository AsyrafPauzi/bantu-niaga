import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import {
  clockOutEmployee,
  ClockEventConflictError,
} from "@/lib/hr/attendance";
import { requireHrAttendanceAccess } from "@/lib/hr/require-attendance-addon";
import { attendanceClockOutSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireHrAttendanceAccess();
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
    parsed = attendanceClockOutSchema.parse(body);
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
    const item = await clockOutEmployee(supabase, {
      businessId: user.businessId,
      eventId: id,
      notes: parsed.notes ?? undefined,
    });

    await writeAuditLog(supabase, {
      businessId: user.businessId,
      actorUserId: user.id,
      action: "hr.attendance.clock_out",
      entityType: "hr_clock_events",
      entityId: id,
      diff: { clock_out: item.clock_out },
    });

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    if (error instanceof ClockEventConflictError) {
      return NextResponse.json(
        {
          error: error.code,
          message: "Clock event not found or already clocked out.",
        },
        { status: 404 },
      );
    }
    throw error;
  }
}
