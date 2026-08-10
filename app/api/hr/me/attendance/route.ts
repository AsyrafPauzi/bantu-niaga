import { NextResponse } from "next/server";
import {
  clockInEmployee,
  clockOutEmployee,
  ClockEventConflictError,
  loadHrClockEvents,
  loadOpenClockEvent,
} from "@/lib/hr/attendance";
import { hasHrShiftAttendanceAddon } from "@/lib/marketplace/entitlements";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const addonActive = await hasHrShiftAttendanceAddon(ctx.user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_inactive",
        message:
          "Shift attendance is not enabled. Ask your owner to activate it in Marketplace.",
      },
      { status: 403 },
    );
  }

  const events = await loadHrClockEvents(ctx.user.businessId, {
    employeeId: ctx.employee.id,
    limit: 30,
  });
  const admin = createServiceRoleClient();
  const open = await loadOpenClockEvent(
    admin,
    ctx.user.businessId,
    ctx.employee.id,
  );

  return NextResponse.json(
    { data: events, open_event: open },
    { status: 200 },
  );
}

export async function POST() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const addonActive = await hasHrShiftAttendanceAddon(ctx.user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_inactive",
        message:
          "Shift attendance is not enabled. Ask your owner to activate it in Marketplace.",
      },
      { status: 403 },
    );
  }

  const admin = createServiceRoleClient();
  const open = await loadOpenClockEvent(
    admin,
    ctx.user.businessId,
    ctx.employee.id,
  );

  try {
    if (open) {
      const item = await clockOutEmployee(admin, {
        businessId: ctx.user.businessId,
        eventId: open.id,
      });
      return NextResponse.json({ action: "clock_out", item }, { status: 200 });
    }

    const item = await clockInEmployee(admin, {
      businessId: ctx.user.businessId,
      employeeId: ctx.employee.id,
      source: "self",
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ action: "clock_in", item }, { status: 201 });
  } catch (error) {
    if (error instanceof ClockEventConflictError) {
      return NextResponse.json(
        { error: error.code, message: "Could not update attendance." },
        { status: 409 },
      );
    }
    throw error;
  }
}
