import { describe, expect, it } from "vitest";
import { mapFinanceTxnExportRows } from "@/lib/finance/transaction-export";

describe("mapFinanceTxnExportRows", () => {
  it("maps receipt and source fields for export", () => {
    const rows = mapFinanceTxnExportRows(
      [
        {
          txn_date: "2026-07-15",
          kind: "expense",
          category: "marketing",
          description: "Meta ads",
          counterparty: "Meta",
          amount_myr: 120,
          payment_method: "card",
          finance_invoice_id: null,
          admin_file_id: "file-1",
        },
        {
          txn_date: "2026-07-16",
          kind: "income",
          category: "invoice_payment",
          description: "POS Sale #12",
          counterparty: null,
          amount_myr: 50,
          payment_method: "cash",
          finance_invoice_id: null,
          admin_file_id: null,
        },
        {
          txn_date: "2026-07-17",
          kind: "income",
          category: "invoice_payment",
          description: "Invoice INV-2026-0001",
          counterparty: "Ali",
          amount_myr: 500,
          payment_method: "bank",
          finance_invoice_id: "inv-1",
          admin_file_id: null,
        },
      ],
      new Map([["file-1", "meta-receipt.pdf"]]),
    );

    expect(rows[0]).toMatchObject({
      txn_date: "2026-07-15",
      category: "marketing",
      amount_myr: "120.00",
      receipt: "meta-receipt.pdf",
      source: "manual",
    });
    expect(rows[1]?.source).toBe("pos");
    expect(rows[2]?.source).toBe("invoice");
  });
});
