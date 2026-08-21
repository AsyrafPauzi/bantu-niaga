import "server-only";

// TODO(tech-debt): pdf-lib v1.17.1 has been unmaintained since 2021.
// No active CVEs as of 2026-08. Monitor https://github.com/Hopding/pdf-lib for
// activity. Replacement candidates: @pdf-lib/fontkit + pdfmake (for text-heavy
// documents), or a Puppeteer-based HTML→PDF approach for design-rich invoices.
// Track in: https://linear.app (or your issue tracker) before go-live v2.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BusinessRow } from "@/lib/settings/business";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";
import {
  formatFinanceShortDate,
  formatQuoteValidUntil,
} from "@/lib/finance/schemas";

function fmtMyr(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function renderFinanceInvoicePdf(
  invoice: FinanceInvoiceRow,
  business: Pick<
    BusinessRow,
    "name" | "registration_no" | "sst_number" | "receipt_footer" | "contact_line"
  >,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.88, 0.88, 0.88);

  let y = 780;
  const kindLabel = invoice.document_kind === "quote" ? "Quote" : "Invoice";

  page.drawText(kindLabel, { x: 48, y, size: 22, font: bold, color: ink });
  y -= 28;
  page.drawText(business.name, { x: 48, y, size: 12, font: bold, color: ink });
  y -= 16;

  if (business.registration_no) {
    page.drawText(`Reg. ${business.registration_no}`, {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    y -= 14;
  }
  if (business.sst_number) {
    page.drawText(`SST No. ${business.sst_number}`, {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    y -= 14;
  }

  page.drawText(`${kindLabel} ${invoice.number}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 14;
  page.drawText(`Date: ${formatFinanceShortDate(invoice.invoice_date)}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 14;
  if (invoice.due_date) {
    const dateLabel =
      invoice.document_kind === "quote"
        ? formatQuoteValidUntil(invoice.due_date)
        : `Due: ${formatFinanceShortDate(invoice.due_date)}`;
    page.drawText(dateLabel, {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    y -= 14;
  }

  y -= 10;
  page.drawText("Bill to", { x: 48, y, size: 10, font: bold, color: ink });
  y -= 14;
  page.drawText(truncate(invoice.customer_name, 60), {
    x: 48,
    y,
    size: 11,
    font: regular,
    color: ink,
  });
  y -= 14;
  if (invoice.customer_email) {
    page.drawText(invoice.customer_email, {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    y -= 14;
  }
  if (invoice.customer_address?.trim()) {
    const addrLines = invoice.customer_address.trim().split(/\n/);
    for (const line of addrLines.slice(0, 4)) {
      page.drawText(truncate(line.trim(), 60), {
        x: 48,
        y,
        size: 10,
        font: regular,
        color: muted,
      });
      y -= 14;
    }
  }

  y -= 14;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 20;

  page.drawText("Description", { x: 48, y, size: 10, font: bold, color: ink });
  page.drawText("Qty", { x: 340, y, size: 10, font: bold, color: ink });
  page.drawText("Amount", { x: 480, y, size: 10, font: bold, color: ink });
  y -= 12;
  page.drawLine({ start: { x: 48, y: y + 4 }, end: { x: 547, y: y + 4 }, thickness: 1, color: line });

  const items = invoice.items ?? [];
  if (items.length === 0) {
    y -= 16;
    page.drawText(invoice.title ?? "Services", {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    page.drawText(fmtMyr(Number(invoice.amount_myr)), {
      x: 480,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 20;
  } else {
    for (const item of items) {
      y -= 16;
      page.drawText(truncate(item.description, 42), {
        x: 48,
        y,
        size: 10,
        font: regular,
        color: ink,
      });
      page.drawText(String(item.quantity), {
        x: 340,
        y,
        size: 10,
        font: regular,
        color: ink,
      });
      page.drawText(fmtMyr(Number(item.line_total_myr)), {
        x: 480,
        y,
        size: 10,
        font: regular,
        color: ink,
      });
      y -= 4;
      if (y < 160) break;
    }
  }

  y -= 20;
  const totalsX = 360;
  page.drawText("Subtotal", { x: totalsX, y, size: 10, font: regular, color: muted });
  page.drawText(fmtMyr(Number(invoice.amount_myr)), {
    x: 480,
    y,
    size: 10,
    font: regular,
    color: ink,
  });
  y -= 14;
  if (Number(invoice.discount_myr) > 0) {
    page.drawText("Discount", { x: totalsX, y, size: 10, font: regular, color: muted });
    page.drawText(`-${fmtMyr(Number(invoice.discount_myr))}`, {
      x: 480,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 14;
  }
  if (Number(invoice.tax_myr) > 0) {
    page.drawText(`SST (${invoice.tax_pct}%)`, {
      x: totalsX,
      y,
      size: 10,
      font: regular,
      color: muted,
    });
    page.drawText(fmtMyr(Number(invoice.tax_myr)), {
      x: 480,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 14;
  }
  if (Number(invoice.shipping_myr) > 0) {
    page.drawText("Shipping", { x: totalsX, y, size: 10, font: regular, color: muted });
    page.drawText(fmtMyr(Number(invoice.shipping_myr)), {
      x: 480,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 14;
  }
  y -= 6;
  page.drawLine({ start: { x: totalsX, y: y + 8 }, end: { x: 547, y: y + 8 }, thickness: 1.5, color: ink });
  page.drawText("Total", { x: totalsX, y: y - 8, size: 12, font: bold, color: ink });
  page.drawText(fmtMyr(Number(invoice.total_myr)), {
    x: 480,
    y: y - 8,
    size: 12,
    font: bold,
    color: ink,
  });

  if (invoice.notes?.trim()) {
    y -= 36;
    page.drawText("Notes", { x: 48, y, size: 10, font: bold, color: ink });
    y -= 14;
    page.drawText(truncate(invoice.notes.trim(), 200), {
      x: 48,
      y,
      size: 9,
      font: regular,
      color: muted,
      maxWidth: 500,
    });
  }

  const footer =
    business.receipt_footer ??
    business.contact_line ??
    "Thank you for your business.";
  page.drawText(truncate(footer, 120), {
    x: 48,
    y: 72,
    size: 9,
    font: regular,
    color: muted,
    maxWidth: 500,
  });

  return pdf.save();
}
