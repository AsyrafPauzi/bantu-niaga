import { NextResponse } from "next/server";
import { loadStaffMeOnboardingItems } from "@/lib/hr/load";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  const items = await loadStaffMeOnboardingItems(
    ctx.user.businessId,
    ctx.employee.id,
  );

  return NextResponse.json({ data: items }, { status: 200 });
}
