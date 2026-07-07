import { describe, expect, it, afterEach } from "vitest";
import {
  isBillplzConfigured,
  renderBillingInvoiceHtml,
  renderBillingInvoicePdf,
} from "@/lib/settings/billing";

describe("isBillplzConfigured", () => {
  const originalKey = process.env.BILLPLZ_API_KEY;
  const originalCollection = process.env.BILLPLZ_COLLECTION_ID;

  afterEach(() => {
    process.env.BILLPLZ_API_KEY = originalKey;
    process.env.BILLPLZ_COLLECTION_ID = originalCollection;
  });

  it("is false when env vars are missing", () => {
    delete process.env.BILLPLZ_API_KEY;
    delete process.env.BILLPLZ_COLLECTION_ID;
    expect(isBillplzConfigured()).toBe(false);
  });

  it("is true when key and collection are set", () => {
    process.env.BILLPLZ_API_KEY = "test-key";
    process.env.BILLPLZ_COLLECTION_ID = "col_123";
    expect(isBillplzConfigured()).toBe(true);
  });
});

describe("renderBillingInvoicePdf", () => {
  it("returns a valid PDF document", async () => {
    const pdf = await renderBillingInvoicePdf(
      {
        id: "inv-1",
        number: "INV-2026-0612",
        kind: "topup",
        period_label: "Fast Credits top-up",
        amount_myr: 10,
        tax_myr: 0,
        status: "paid",
        paid_at: "2026-07-07T00:00:00.000Z",
        created_at: "2026-07-07T00:00:00.000Z",
      },
      {
        name: "Demo Sdn Bhd",
        registration_no: "123456-A",
        sst_number: null,
        contact_line: null,
        receipt_footer: null,
      },
    );

    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
