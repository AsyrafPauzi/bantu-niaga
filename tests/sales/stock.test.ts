import { describe, expect, it } from "vitest";
import {
  decrementProductStock,
  restoreProductStock,
  type StockLine,
} from "@/lib/sales/stock";

const BIZ = "00000000-0000-0000-0000-000000000aaa";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";

function createStockMock(initialQty: number | null) {
  let qty = initialQty;
  const supabase = {
    from: (table: string) => {
      if (table !== "operations_products") throw new Error("unexpected table");
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  qty === undefined
                    ? null
                    : { id: PRODUCT_ID, stock_qty: qty },
                error: null,
              }),
            }),
          }),
        }),
        update: (patch: { stock_qty: number }) => {
          const apply = async () => {
            qty = patch.stock_qty;
            return { error: null };
          };
          const chain = {
            eq: () => chain,
            then: (
              resolve: (v: { error: null }) => void,
              reject?: (e: unknown) => void,
            ) => apply().then(resolve, reject),
          };
          return chain;
        },
      };
    },
  };
  return {
    supabase: supabase as unknown as Parameters<
      typeof decrementProductStock
    >[0],
    getQty: () => qty,
  };
}

describe("decrementProductStock", () => {
  it("decrements tracked stock", async () => {
    const { supabase, getQty } = createStockMock(10);
    const lines: StockLine[] = [{ product_id: PRODUCT_ID, quantity: 3 }];
    await decrementProductStock(supabase, BIZ, lines);
    expect(getQty()).toBe(7);
  });

  it("skips products with null stock_qty", async () => {
    const { supabase, getQty } = createStockMock(null);
    await decrementProductStock(supabase, BIZ, [
      { product_id: PRODUCT_ID, quantity: 5 },
    ]);
    expect(getQty()).toBeNull();
  });

  it("throws when insufficient stock", async () => {
    const { supabase } = createStockMock(2);
    await expect(
      decrementProductStock(supabase, BIZ, [
        { product_id: PRODUCT_ID, quantity: 5 },
      ]),
    ).rejects.toThrow(/Insufficient stock/);
  });
});

describe("restoreProductStock", () => {
  it("increments stock on void", async () => {
    const { supabase, getQty } = createStockMock(7);
    await restoreProductStock(supabase, BIZ, [
      { product_id: PRODUCT_ID, quantity: 3 },
    ]);
    expect(getQty()).toBe(10);
  });

  it("skips untracked stock on restore", async () => {
    const { supabase, getQty } = createStockMock(null);
    await restoreProductStock(supabase, BIZ, [
      { product_id: PRODUCT_ID, quantity: 3 },
    ]);
    expect(getQty()).toBeNull();
  });
});
