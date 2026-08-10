import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CustomerStatementData } from "@/lib/finance/statement";
import type { BusinessRow } from "@/lib/settings/business";
import { formatFinanceShortDate, formatMyr } from "@/lib/finance/schemas";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function renderCustomerStatementPdf(
  statement: CustomerStatementData,
  business: Pick<BusinessRow, "name" | "registration_no" | "contact_line">,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.88, 0.88, 0.88);

  let y = 780;
  page.drawText("Statement of Account", { x: 48, y, size: 20, font: bold, color: ink });
  y -= 24;
  page.drawText(business.name, { x: 48, y, size: 12, font: bold, color: ink });
  y -= 18;
  page.drawText(`Customer: ${truncate(statement.customer.name, 50)}`, {
    x: 48,
    y,
    size: 11,
    font: regular,
    color: ink,
  });
  y -= 14;
  if (statement.customer.address?.trim()) {
    page.drawText(truncate(statement.customer.address.trim(), 60), {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    y -= 14;
  }
  y -= 8;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 18;

  page.drawText("Invoice", { x: 48, y, size: 10, font: bold, color: ink });
  page.drawText("Date", { x: 180, y, size: 10, font: bold, color: ink });
  page.drawText("Status", { x: 280, y, size: 10, font: bold, color: ink });
  page.drawText("Amount", { x: 480, y, size: 10, font: bold, color: ink });
  y -= 12;
  page.drawLine({ start: { x: 48, y: y + 4 }, end: { x: 547, y: y + 4 }, thickness: 1, color: line });

  for (const inv of statement.invoices) {
    y -= 16;
    if (y < 120) break;
    page.drawText(truncate(inv.number, 18), { x: 48, y, size: 9, font: regular, color: ink });
    page.drawText(formatFinanceShortDate(inv.invoice_date), {
      x: 180,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawText(inv.status.toUpperCase(), {
      x: 280,
      y,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawText(formatMyr(Number(inv.total_myr)), {
      x: 480,
      y,
      size: 9,
      font: regular,
      color: ink,
    });
  }

  y -= 24;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 18;
  page.drawText(`Total billed: ${formatMyr(statement.summary.total_billed_myr)}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: ink,
  });
  y -= 14;
  page.drawText(`Total paid: ${formatMyr(statement.summary.total_paid_myr)}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: ink,
  });
  y -= 14;
  page.drawText(`Outstanding: ${formatMyr(statement.summary.outstanding_myr)}`, {
    x: 48,
    y,
    size: 11,
    font: bold,
    color: ink,
  });

  return pdf.save();
}
