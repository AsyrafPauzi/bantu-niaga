import { NextResponse } from "next/server";
import { requireStaffMeContext } from "@/lib/hr/staff-self-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireStaffMeContext();
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({ employee: ctx.employee }, { status: 200 });
}
