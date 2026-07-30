import { NextResponse } from "next/server";
import { loadStaffMeLeaveRecord } from "@/lib/hr/load";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await context.params;
  const leave = await loadStaffMeLeaveRecord(
    ctx.user.businessId,
    ctx.employee.id,
    id,
  );

  if (!leave) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ leave }, { status: 200 });
}
