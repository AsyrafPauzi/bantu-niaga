import { NextResponse } from "next/server";
import { loadHrEmployeeLeaveBalanceSummary } from "@/lib/hr/load";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const entitlement =
    ctx.employee.annual_leave_entitlement_days != null
      ? ctx.employee.annual_leave_entitlement_days
      : 14;

  const balance = await loadHrEmployeeLeaveBalanceSummary(
    ctx.user.businessId,
    ctx.employee.id,
    entitlement,
  );

  return NextResponse.json({ balance }, { status: 200 });
}
