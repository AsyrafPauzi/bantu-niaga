import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BillingInvoiceRow {
  id: string;
  number: string;
  kind: "subscription" | "topup" | "addon" | "manual";
  period_label: string | null;
  amount_myr: number;
  tax_myr: number;
  status: "paid" | "pending" | "failed" | "refunded";
  paid_at: string | null;
  created_at: string;
}

export interface BillingBusinessRow {
  name: string;
  registration_no: string | null;
  sst_number: string | null;
  contact_line: string | null;
  receipt_footer: string | null;
}

/** True when live Billplz checkout can be created. */
export function isBillplzConfigured(): boolean {
  const key = process.env.BILLPLZ_API_KEY?.trim();
  const collection = process.env.BILLPLZ_COLLECTION_ID?.trim();
  return Boolean(key && collection);
}

/**
 * Every business gets one default Billplz gateway row. Billplz handles FPX,
 * credit card, and debit card at checkout — we do not store multiple methods.
 */
export async function ensureBillplzPaymentMethod(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("business_id", businessId)
    .eq("provider", "billplz")
    .eq("is_default", true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: anyBillplz } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("business_id", businessId)
    .eq("provider", "billplz")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyBillplz?.id) {
    await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("business_id", businessId)
      .eq("is_default", true);

    await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", anyBillplz.id);

    return anyBillplz.id;
  }

  await supabase
    .from("payment_methods")
    .update({ is_default: false })
    .eq("business_id", businessId)
    .eq("is_default", true);

  const { data: created, error } = await supabase
    .from("payment_methods")
    .insert({
      business_id: businessId,
      kind: "fpx",
      label: "Billplz",
      masked: "FPX · Credit · Debit",
      provider: "billplz",
      is_default: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !created?.id) {
    throw new Error(error?.message ?? "Could not create Billplz payment method");
  }

  return created.id;
}

function fmtMyr(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function kindLabel(kind: BillingInvoiceRow["kind"]): string {
  switch (kind) {
    case "subscription":
      return "Subscription";
    case "topup":
      return "Fast Credits top-up";
    case "addon":
      return "Marketplace add-on";
    default:
      return "Billing";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Printable tax invoice / receipt (HTML fallback for previews). */
export function renderBillingInvoiceHtml(
  invoice: BillingInvoiceRow,
  business: BillingBusinessRow,
): string {
  const subtotal = Number(invoice.amount_myr);
  const tax = Number(invoice.tax_myr);
  const total = subtotal + tax;
  const title = invoice.period_label ?? kindLabel(invoice.kind);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.number)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; margin: 40px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 10px 0; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    .totals { margin-top: 16px; width: 280px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .total { font-weight: 700; font-size: 18px; border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; }
    .footer { margin-top: 32px; font-size: 12px; color: #666; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Tax Invoice</h1>
  <p class="muted">${escapeHtml(business.name)}</p>
  ${
    business.registration_no
      ? `<p class="muted">Reg. ${escapeHtml(business.registration_no)}</p>`
      : ""
  }
  ${
    business.sst_number
      ? `<p class="muted">SST No. ${escapeHtml(business.sst_number)}</p>`
      : ""
  }
  <p class="muted">Invoice ${escapeHtml(invoice.number)} · ${escapeHtml(fmtDate(invoice.paid_at ?? invoice.created_at))}</p>
  <p class="muted">Status: ${escapeHtml(invoice.status)}</p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(title)}</td>
        <td>${escapeHtml(fmtMyr(subtotal))}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${escapeHtml(fmtMyr(subtotal))}</span></div>
    <div><span>SST</span><span>${escapeHtml(fmtMyr(tax))}</span></div>
    <div class="total"><span>Total</span><span>${escapeHtml(fmtMyr(total))}</span></div>
  </div>

  ${
    business.receipt_footer
      ? `<p class="footer">${escapeHtml(business.receipt_footer)}</p>`
      : `<p class="footer">Thank you for your business.</p>`
  }
</body>
</html>`;
}

/** Printable tax invoice as PDF bytes (A4). */
export async function renderBillingInvoicePdf(
  invoice: BillingInvoiceRow,
  business: BillingBusinessRow,
): Promise<Uint8Array> {
  const subtotal = Number(invoice.amount_myr);
  const tax = Number(invoice.tax_myr);
  const total = subtotal + tax;
  const title = invoice.period_label ?? kindLabel(invoice.kind);
  const issued = fmtDate(invoice.paid_at ?? invoice.created_at);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);
  const line = rgb(0.88, 0.88, 0.88);

  let y = 780;

  page.drawText("Tax Invoice", { x: 48, y, size: 22, font: bold, color: ink });
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

  page.drawText(`Invoice ${invoice.number}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 14;
  page.drawText(`Date: ${issued}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 14;
  page.drawText(`Status: ${invoice.status}`, {
    x: 48,
    y,
    size: 10,
    font: regular,
    color: muted,
  });

  y -= 28;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: line });
  y -= 22;

  page.drawText("Description", { x: 48, y, size: 10, font: bold, color: ink });
  page.drawText("Amount", { x: 480, y, size: 10, font: bold, color: ink });
  y -= 16;
  page.drawLine({ start: { x: 48, y: y + 6 }, end: { x: 547, y: y + 6 }, thickness: 1, color: line });

  page.drawText(title, { x: 48, y: y - 10, size: 11, font: regular, color: ink });
  page.drawText(fmtMyr(subtotal), {
    x: 480,
    y: y - 10,
    size: 11,
    font: regular,
    color: ink,
  });
  y -= 36;

  const totalsX = 380;
  page.drawText("Subtotal", { x: totalsX, y, size: 10, font: regular, color: muted });
  page.drawText(fmtMyr(subtotal), { x: 480, y, size: 10, font: regular, color: ink });
  y -= 16;
  page.drawText("SST", { x: totalsX, y, size: 10, font: regular, color: muted });
  page.drawText(fmtMyr(tax), { x: 480, y, size: 10, font: regular, color: ink });
  y -= 18;
  page.drawLine({ start: { x: totalsX, y: y + 8 }, end: { x: 547, y: y + 8 }, thickness: 1.5, color: ink });
  page.drawText("Total", { x: totalsX, y: y - 8, size: 12, font: bold, color: ink });
  page.drawText(fmtMyr(total), { x: 480, y: y - 8, size: 12, font: bold, color: ink });

  const footer = business.receipt_footer ?? "Thank you for your business.";
  page.drawText(footer, {
    x: 48,
    y: 72,
    size: 9,
    font: regular,
    color: muted,
    maxWidth: 500,
  });

  return pdf.save();
}
