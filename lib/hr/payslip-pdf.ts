import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { HrPayslipRow } from "@/lib/hr/payslips";
import { formatPayslipPeriodLabel } from "@/lib/hr/payslips";
import { MY_STATUTORY_YEAR } from "@/lib/hr/malaysia-statutory";
import { formatMyr } from "@/lib/finance/schemas";
import type { BusinessRow } from "@/lib/settings/business";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function renderPayslipPdf(
  payslip: HrPayslipRow,
  business: Pick<BusinessRow, "name" | "registration_no" | "contact_line">,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.88, 0.88, 0.88);

  const employeeName = payslip.hr_employees?.full_name ?? "Employee";
  const roleTitle = payslip.hr_employees?.role_title ?? "";
  const employeeNumber = payslip.hr_employees?.employee_number?.trim() ?? "";
  const periodLabel = formatPayslipPeriodLabel(payslip.period_start);
  const ref = `PS-${payslip.period_start.slice(0, 7).replace("-", "")}-${payslip.id.slice(0, 8).toUpperCase()}`;

  let y = 800;
  page.drawText(truncate(business.name, 48), {
    x: 48,
    y,
    size: 16,
    font: bold,
    color: ink,
  });
  y -= 16;
  if (business.registration_no?.trim()) {
    page.drawText(`Reg. No: ${truncate(business.registration_no, 40)}`, {
      x: 48,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    y -= 12;
  }
  if (business.contact_line?.trim()) {
    page.drawText(truncate(business.contact_line, 70), {
      x: 48,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    y -= 12;
  }

  y -= 8;
  page.drawText("PAYSLIP", { x: 48, y, size: 18, font: bold, color: ink });
  page.drawText(ref, { x: 400, y, size: 9, font: regular, color: muted });
  y -= 16;
  page.drawText(`Pay period: ${periodLabel}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  page.drawText(`Period end: ${payslip.period_end}`, {
    x: 320,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 18;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 18;

  page.drawText("Employee", { x: 48, y, size: 10, font: bold, color: ink });
  y -= 14;
  page.drawText(truncate(employeeName, 50), {
    x: 48,
    y,
    size: 11,
    font: regular,
    color: ink,
  });
  y -= 13;
  if (employeeNumber) {
    page.drawText(`Employee no: ${truncate(employeeNumber, 30)}`, {
      x: 48,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    y -= 12;
  }
  if (roleTitle.trim()) {
    page.drawText(truncate(roleTitle, 60), {
      x: 48,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    y -= 12;
  }

  y -= 8;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 20;

  page.drawText("Earnings", { x: 48, y, size: 11, font: bold, color: ink });
  y -= 16;
  page.drawText("Basic salary", { x: 48, y, size: 10, font: regular, color: ink });
  page.drawText(formatMyr(payslip.gross_myr), {
    x: 460,
    y,
    size: 10,
    font: regular,
    color: ink,
  });
  y -= 18;
  page.drawText("Gross pay", { x: 48, y, size: 10, font: bold, color: ink });
  page.drawText(formatMyr(payslip.gross_myr), {
    x: 460,
    y,
    size: 10,
    font: bold,
    color: ink,
  });
  y -= 22;

  if (payslip.deductions.length > 0) {
    page.drawText("Employee deductions (statutory)", {
      x: 48,
      y,
      size: 11,
      font: bold,
      color: ink,
    });
    y -= 16;
    for (const deduction of payslip.deductions) {
      page.drawText(truncate(deduction.label, 48), {
        x: 56,
        y,
        size: 9,
        font: regular,
        color: muted,
      });
      page.drawText(`-${formatMyr(deduction.amount_myr)}`, {
        x: 460,
        y,
        size: 9,
        font: regular,
        color: ink,
      });
      y -= 13;
    }
    y -= 6;
  }

  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1.5, color: ink });
  y -= 18;
  page.drawText("Net pay", { x: 48, y, size: 13, font: bold, color: ink });
  page.drawText(formatMyr(payslip.net_myr), {
    x: 460,
    y,
    size: 13,
    font: bold,
    color: ink,
  });
  y -= 24;

  if (payslip.employer_contributions.length > 0) {
    page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
    y -= 18;
    page.drawText("Employer contributions (not deducted from net)", {
      x: 48,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    y -= 14;
    for (const row of payslip.employer_contributions) {
      page.drawText(truncate(row.label, 48), {
        x: 56,
        y,
        size: 9,
        font: regular,
        color: muted,
      });
      page.drawText(formatMyr(row.amount_myr), {
        x: 460,
        y,
        size: 9,
        font: regular,
        color: ink,
      });
      y -= 13;
    }
    y -= 8;
  }

  page.drawText(
    `Statutory rates: Malaysia ${MY_STATUTORY_YEAR} (KWSP / PERKESO / LHDN). ` +
      "PCB is an MTD estimate for a resident with no TP1 dependents. " +
      "Remit via KWSP i-Akaun, PERKESO ASSIST, and LHDN e-PCB using official tables.",
    {
      x: 48,
      y: Math.max(48, y - 8),
      size: 7.5,
      font: regular,
      color: muted,
      maxWidth: 500,
      lineHeight: 10,
    },
  );

  return pdf.save();
}
