import { describe, expect, it } from "vitest";
import { renderFinanceInvoicePdf } from "@/lib/finance/invoice-pdf";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";

const sampleInvoice: FinanceInvoiceRow = {
  id: "inv-1",
  business_id: "biz-1",
  number: "INV-2026-001",
  share_hash: "abc123",
  customer_id: null,
  customer_name: "Ali Trading",
  customer_email: "ali@example.com",
  customer_phone: null,
  title: "Consulting",
  description: null,
  invoice_date: "2026-07-01",
  amount_myr: 100,
  discount_myr: 0,
  discount_pct: 0,
  tax_myr: 8,
  tax_pct: 8,
  shipping_myr: 0,
  total_myr: 108,
  status: "sent",
  due_date: "2026-07-15",
  notes: null,
  paid_at: null,
  sent_at: null,
  document_kind: "invoice",
  show_duitnow: false,
  converted_from_id: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  items: [
    {
      id: "line-1",
      business_id: "biz-1",
      invoice_id: "inv-1",
      description: "Monthly retainer",
      unit_price: 100,
      quantity: 1,
      unit: "month",
      taxable: true,
      sort_order: 0,
      line_total_myr: 100,
    },
  ],
};

describe("renderFinanceInvoicePdf", () => {
  it("returns non-empty PDF bytes", async () => {
    const pdf = await renderFinanceInvoicePdf(sampleInvoice, {
      name: "Demo Sdn Bhd",
      registration_no: "123456-A",
      sst_number: "W10-1234-56789012",
      receipt_footer: "Thank you",
      contact_line: null,
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(pdf[0])).toBe("%");
  });
});
