import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CustomerStatementData } from "@/lib/finance/statement";
import type { BusinessRow } from "@/lib/settings/business";
import { formatFinanceShortDate, formatMyr } from "@/lib/finance/schemas";

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function rightAlign(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  rightEdge: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightEdge - w, y, size, font, color });
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function renderCustomerStatementPdf(
  statement: CustomerStatementData,
  business: Pick<BusinessRow, "name" | "registration_no" | "contact_line">,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const W = 595.28;
  const MARGIN = 48;
  const RIGHT = W - MARGIN;

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const INK   = rgb(0.07, 0.07, 0.07);
  const MUTED = rgb(0.42, 0.42, 0.42);
  const WHITE = rgb(1, 1, 1);
  const DARK  = rgb(0.18, 0.18, 0.18);   // dark header row bg
  const LIGHT_BG = rgb(0.96, 0.96, 0.96); // account summary header
  const LINE  = rgb(0.88, 0.88, 0.88);
  const GREEN = rgb(0.06, 0.53, 0.27);

  let y = 800;

  // ── Business name (top-right) ─────────────────────────────────────────────
  rightAlign(page, truncate(business.name, 40), RIGHT, y, 11, bold, INK);
  if (business.contact_line) {
    y -= 14;
    rightAlign(page, truncate(business.contact_line, 50), RIGHT, y, 9, regular, MUTED);
  }
  y -= 14;
  if (business.registration_no) {
    rightAlign(page, `Reg: ${business.registration_no}`, RIGHT, y, 9, regular, MUTED);
  }

  // ── "Statement of Accounts" title (right-aligned) ─────────────────────────
  y -= 30;
  const title = "Statement of Accounts";
  const titleW = bold.widthOfTextAtSize(title, 18);
  page.drawText(title, { x: RIGHT - titleW, y, size: 18, font: bold, color: INK });

  // Title underline
  y -= 4;
  page.drawLine({ start: { x: RIGHT - titleW, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });

  // Date range
  const sorted = [...statement.invoices].sort(
    (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime(),
  );
  if (sorted.length > 0) {
    const from = formatFinanceShortDate(sorted[0].invoice_date);
    const to   = formatFinanceShortDate(sorted[sorted.length - 1].invoice_date);
    const rangeText = `${from} to ${to}`;
    y -= 14;
    rightAlign(page, rangeText, RIGHT, y, 9, regular, MUTED);
  }

  // ── Account Summary box (right side) ─────────────────────────────────────
  const summaryX = RIGHT - 200;
  const summaryRight = RIGHT;
  y -= 18;
  const summaryTop = y;

  // Header row
  page.drawRectangle({ x: summaryX, y: summaryTop - 2, width: summaryRight - summaryX, height: 18, color: LIGHT_BG });
  page.drawText("Account Summary", { x: summaryX + 6, y: summaryTop + 2, size: 9, font: bold, color: INK });

  const summaryRows: [string, number][] = [
    ["Opening Balance", 0],
    ["Invoiced Amount", statement.summary.total_billed_myr],
    ["Amount Paid", statement.summary.total_paid_myr],
    ["Balance Due", statement.summary.outstanding_myr],
  ];

  let sy = summaryTop - 16;
  for (const [label, value] of summaryRows) {
    const isLast = label === "Balance Due";
    if (isLast) {
      page.drawLine({ start: { x: summaryX, y: sy + 12 }, end: { x: summaryRight, y: sy + 12 }, thickness: 0.5, color: LINE });
    }
    page.drawText(label, { x: summaryX + 6, y: sy, size: 9, font: isLast ? bold : regular, color: isLast ? INK : MUTED });
    rightAlign(page, formatMyr(value), summaryRight - 4, sy, 9, isLast ? bold : regular, INK);
    sy -= 16;
  }

  // Outer border for summary box
  const summaryHeight = summaryTop - sy + 4;
  page.drawRectangle({ x: summaryX, y: sy + 4, width: summaryRight - summaryX, height: summaryHeight, borderColor: LINE, borderWidth: 0.5 });

  // ── "To" section (left side, same vertical band as summary) ──────────────
  let toY = summaryTop + 16;
  page.drawText("To", { x: MARGIN, y: toY, size: 9, font: bold, color: MUTED });
  toY -= 14;
  page.drawText(truncate(statement.customer.name, 35), { x: MARGIN, y: toY, size: 10, font: bold, color: INK });
  if (statement.customer.email) {
    toY -= 13;
    page.drawText(truncate(statement.customer.email, 40), { x: MARGIN, y: toY, size: 9, font: regular, color: MUTED });
  }
  if (statement.customer.phone_e164) {
    toY -= 13;
    page.drawText(truncate(statement.customer.phone_e164, 30), { x: MARGIN, y: toY, size: 9, font: regular, color: MUTED });
  }
  if (statement.customer.address?.trim()) {
    for (const line of statement.customer.address.trim().split("\n").slice(0, 3)) {
      toY -= 13;
      page.drawText(truncate(line.trim(), 40), { x: MARGIN, y: toY, size: 9, font: regular, color: MUTED });
    }
  }

  // ── Gap before table ──────────────────────────────────────────────────────
  y = Math.min(sy - 10, toY - 14);

  // ── Table columns ─────────────────────────────────────────────────────────
  const COL = {
    date:    MARGIN,
    txn:     MARGIN + 72,
    details: MARGIN + 154,
    amount:  RIGHT - 148,
    payment: RIGHT - 72,
    balance: RIGHT,
  };

  // Dark header row
  const headerH = 22;
  page.drawRectangle({ x: MARGIN, y: y - headerH + 4, width: RIGHT - MARGIN, height: headerH, color: DARK });

  const headerY = y - headerH + 9;
  const headers: [string, number, boolean][] = [
    ["Date",         COL.date,    false],
    ["Transactions", COL.txn,     false],
    ["Details",      COL.details, false],
    ["Amount",       COL.amount,  true],
    ["Payments",     COL.payment, true],
    ["Balance",      COL.balance, true],
  ];
  for (const [label, x, rightAlign_] of headers) {
    if (rightAlign_) {
      rightAlign(page, label, x, headerY, 8, bold, WHITE);
    } else {
      page.drawText(label, { x, y: headerY, size: 8, font: bold, color: WHITE });
    }
  }
  y -= headerH + 2;

  // ── Opening balance row ───────────────────────────────────────────────────
  page.drawText("—", { x: COL.date, y, size: 8, font: regular, color: MUTED });
  page.drawText("***Opening Balance***", { x: COL.txn, y, size: 8, font: bold, color: INK });
  rightAlign(page, formatMyr(0), COL.amount, y, 8, regular, MUTED);
  rightAlign(page, formatMyr(0), COL.balance, y, 8, regular, INK);
  y -= 2;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.3, color: LINE });
  y -= 16;

  // ── Transaction rows ──────────────────────────────────────────────────────
  let runningBalance = 0;

  for (const inv of sorted) {
    const total = Number(inv.total_myr ?? 0);
    const isPaid = inv.status === "paid";
    const details = `${inv.number}${inv.due_date ? ` – due ${formatFinanceShortDate(inv.due_date)}` : ""}`;

    // Invoice row
    runningBalance += total;
    if (y < 80) break;
    page.drawText(formatFinanceShortDate(inv.invoice_date), { x: COL.date, y, size: 8, font: regular, color: MUTED });
    page.drawText("Invoice", { x: COL.txn, y, size: 8, font: regular, color: INK });
    page.drawText(truncate(details, 32), { x: COL.details, y, size: 8, font: regular, color: MUTED });
    rightAlign(page, formatMyr(total), COL.amount, y, 8, regular, INK);
    rightAlign(page, formatMyr(runningBalance), COL.balance, y, 8, regular, INK);
    y -= 3;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.3, color: LINE });
    y -= 17;

    // Payment Received row (if paid)
    if (isPaid) {
      runningBalance -= total;
      const payDate = inv.paid_at ? inv.paid_at.slice(0, 10) : inv.invoice_date;
      const payDetails = `${formatMyr(total)} for payment of ${inv.number}`;
      if (y < 80) break;
      page.drawText(formatFinanceShortDate(payDate), { x: COL.date, y, size: 8, font: regular, color: MUTED });
      page.drawText("Payment Received", { x: COL.txn, y, size: 8, font: regular, color: INK });
      page.drawText(truncate(payDetails, 32), { x: COL.details, y, size: 8, font: regular, color: MUTED });
      rightAlign(page, formatMyr(total), COL.payment, y, 8, regular, GREEN);
      rightAlign(page, formatMyr(runningBalance), COL.balance, y, 8, regular, INK);
      y -= 3;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.3, color: LINE });
      y -= 17;
    }
  }

  // ── Balance Due footer ────────────────────────────────────────────────────
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.5, color: LINE });
  y -= 14;
  const bdLabel = "Balance Due";
  const bdLabelW = bold.widthOfTextAtSize(bdLabel, 9);
  page.drawText(bdLabel, { x: COL.payment - bdLabelW - 4, y, size: 9, font: bold, color: INK });
  rightAlign(page, formatMyr(statement.summary.outstanding_myr), RIGHT, y, 10, bold, INK);

  return pdf.save();
}
