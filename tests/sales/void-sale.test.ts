import { describe, expect, it } from "vitest";
import { voidPosSale } from "@/lib/sales/void-sale";

const BIZ = "00000000-0000-0000-0000-000000000aaa";
const USER = "50000000-0000-4000-8000-000000000005";
const SALE_ID = "60000000-0000-4000-8000-000000000006";
const TXN_ID = "70000000-0000-4000-8000-000000000007";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";

type SaleRow = {
  id: string;
  sale_number: string;
  status: string;
  finance_transaction_id: string | null;
  business_id: string;
};

function createVoidMock(opts: {
  sale: SaleRow | null;
  items?: Array<{ product_id: string | null; quantity: number }>;
  saleError?: string;
}) {
  let saleStatus = opts.sale?.status ?? "completed";
  let txnDeleted = false;
  let stockQty = 10;

  const supabase = {
    from: (table: string) => {
      if (table === "pos_sales") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  if (opts.saleError) {
                    return { data: null, error: { message: opts.saleError } };
                  }
                  if (!opts.sale) return { data: null, error: null };
                  return {
                    data: { ...opts.sale, status: saleStatus },
                    error: null,
                  };
                },
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: () => ({
                eq: async () => {
                  saleStatus = String(patch.status);
                  return { error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === "pos_sale_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: opts.items ?? [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "finance_transactions") {
        return {
          update: () => ({
            eq: () => ({
              eq: async () => {
                txnDeleted = true;
                return { error: null };
              },
            }),
          }),
        };
      }
      if (table === "operations_products") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: PRODUCT_ID, stock_qty: stockQty },
                  error: null,
                }),
              }),
            }),
          }),
          update: (patch: { stock_qty: number }) => ({
            eq: () => ({
              eq: async () => {
                stockQty = patch.stock_qty;
                return { error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _txnDeleted: () => txnDeleted,
    _saleStatus: () => saleStatus,
    _stockQty: () => stockQty,
  };

  return supabase as unknown as Parameters<typeof voidPosSale>[0]["supabase"] & {
    _txnDeleted: () => boolean;
    _saleStatus: () => string;
    _stockQty: () => number;
  };
}

describe("voidPosSale", () => {
  it("returns not_found when sale missing", async () => {
    const supabase = createVoidMock({ sale: null });
    const r = await voidPosSale({
      supabase,
      businessId: BIZ,
      userId: USER,
      saleId: SALE_ID,
    });
    expect(r).toEqual({ ok: false, error: "sale_not_found" });
  });

  it("returns already_voided for voided sale", async () => {
    const supabase = createVoidMock({
      sale: {
        id: SALE_ID,
        sale_number: "POS-1",
        status: "voided",
        finance_transaction_id: TXN_ID,
        business_id: BIZ,
      },
    });
    const r = await voidPosSale({
      supabase,
      businessId: BIZ,
      userId: USER,
      saleId: SALE_ID,
    });
    expect(r).toEqual({ ok: false, error: "already_voided" });
  });

  it("voids sale, soft-deletes finance txn, restores stock", async () => {
    const mock = createVoidMock({
      sale: {
        id: SALE_ID,
        sale_number: "POS-1",
        status: "completed",
        finance_transaction_id: TXN_ID,
        business_id: BIZ,
      },
      items: [{ product_id: PRODUCT_ID, quantity: 2 }],
    });
    const r = await voidPosSale({
      supabase: mock,
      businessId: BIZ,
      userId: USER,
      saleId: SALE_ID,
      reason: "Wrong item",
    });
    expect(r).toEqual({ ok: true });
    expect(mock._saleStatus()).toBe("voided");
    expect(mock._txnDeleted()).toBe(true);
    expect(mock._stockQty()).toBe(12);
  });
});
