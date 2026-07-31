import { describe, expect, it, vi, beforeEach } from "vitest";
import { voidPosSale } from "@/lib/sales/void-sale";

const dispatchSaleVoided = vi.fn();

vi.mock("@/lib/events/dispatch-sale", () => ({
  dispatchSaleVoided: (...args: unknown[]) => dispatchSaleVoided(...args),
}));

const BIZ = "00000000-0000-0000-0000-000000000aaa";
const USER = "50000000-0000-4000-8000-000000000005";
const SALE_ID = "60000000-0000-4000-8000-000000000006";
const TXN_ID = "70000000-0000-4000-8000-000000000007";

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
      throw new Error(`unexpected table ${table}`);
    },
    _saleStatus: () => saleStatus,
  };

  return supabase as unknown as Parameters<typeof voidPosSale>[0]["supabase"] & {
    _saleStatus: () => string;
  };
}

describe("voidPosSale", () => {
  beforeEach(() => {
    dispatchSaleVoided.mockReset();
    dispatchSaleVoided.mockResolvedValue(undefined);
  });

  it("returns not_found when sale missing", async () => {
    const supabase = createVoidMock({ sale: null });
    const r = await voidPosSale({
      supabase,
      businessId: BIZ,
      userId: USER,
      saleId: SALE_ID,
    });
    expect(r).toEqual({ ok: false, error: "sale_not_found" });
    expect(dispatchSaleVoided).not.toHaveBeenCalled();
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
    expect(dispatchSaleVoided).not.toHaveBeenCalled();
  });

  it("voids sale and dispatches sale.voided event", async () => {
    const mock = createVoidMock({
      sale: {
        id: SALE_ID,
        sale_number: "POS-1",
        status: "completed",
        finance_transaction_id: TXN_ID,
        business_id: BIZ,
      },
      items: [{ product_id: "10000000-0000-4000-8000-000000000001", quantity: 2 }],
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
    expect(dispatchSaleVoided).toHaveBeenCalledOnce();
    expect(dispatchSaleVoided).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        payload: expect.objectContaining({
          sale_id: SALE_ID,
          finance_transaction_id: TXN_ID,
        }),
      }),
    );
  });
});
