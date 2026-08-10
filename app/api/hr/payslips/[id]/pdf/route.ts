import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrPayslip } from "@/lib/hr/payslips";
import { renderPayslipPdf } from "@/lib/hr/payslip-pdf";
import { loadHrEmployeeByUserId } from "@/lib/hr/staff-self-service";
import { loadBusiness } from "@/lib/settings/business";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { id } = await context.params;
  const payslip = await loadHrPayslip(user.businessId, id);
  if (!payslip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!canManageHrCore(user.role)) {
    const employee = await loadHrEmployeeByUserId(user.businessId, user.id);
    if (!employee || employee.id !== payslip.employee_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const business = await loadBusiness(user.businessId);
  if (!business) {
    return NextResponse.json({ error: "business_not_found" }, { status: 500 });
  }

  const pdfBytes = await renderPayslipPdf(payslip, business);
  const employeeSlug = (payslip.hr_employees?.full_name ?? "employee").replace(
    /[^\w-]+/g,
    "-",
  );
  const monthSlug = payslip.period_start.slice(0, 7);
  const filename = `simple-payslip-${employeeSlug}-${monthSlug}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
