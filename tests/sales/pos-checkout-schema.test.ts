import { describe, expect, it } from "vitest";
import { buildPosPrefillUrl } from "@/lib/sales/pos-prefill";
import {
  computePosTotals,
  posCheckoutItemSchema,
  posCheckoutSchema,
} from "@/lib/sales/schemas";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const SERVICE_ID = "20000000-0000-4000-8000-000000000002";
const CUSTOMER_ID = "30000000-0000-4000-8000-000000000003";

describe("posCheckoutItemSchema", () => {
  it("accepts product line", () => {
    const r = posCheckoutItemSchema.safeParse({
      product_id: PRODUCT_ID,
      quantity: 2,
    });
    expect(r.success).toBe(true);
  });

  it("accepts service line", () => {
    const r = posCheckoutItemSchema.safeParse({
      service_id: SERVICE_ID,
      quantity: 1,
    });
    expect(r.success).toBe(true);
  });

  it("rejects line with both product and service", () => {
    const r = posCheckoutItemSchema.safeParse({
      product_id: PRODUCT_ID,
      service_id: SERVICE_ID,
      quantity: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects line with neither product nor service", () => {
    const r = posCheckoutItemSchema.safeParse({ quantity: 1 });
    expect(r.success).toBe(false);
  });
});

describe("posCheckoutSchema", () => {
  const base = {
    items: [{ product_id: PRODUCT_ID, quantity: 1 }],
    payment_method: "cash" as const,
  };

  it("accepts mixed product and service items", () => {
    const r = posCheckoutSchema.safeParse({
      ...base,
      items: [
        { product_id: PRODUCT_ID, quantity: 2 },
        { service_id: SERVICE_ID, quantity: 1 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts coupon_code without manual discount", () => {
    const r = posCheckoutSchema.safeParse({
      ...base,
      coupon_code: "SAVE10",
    });
    expect(r.success).toBe(true);
  });

  it("rejects coupon_code with manual discount", () => {
    const r = posCheckoutSchema.safeParse({
      ...base,
      coupon_code: "SAVE10",
      discount_type: "amount",
      discount_value: 5,
    });
    expect(r.success).toBe(false);
  });

  it("accepts customer_name without customer_id (lead pre-fill)", () => {
    const r = posCheckoutSchema.safeParse({
      ...base,
      customer_name: "Ahmad",
    });
    expect(r.success).toBe(true);
  });

  it("accepts customer_id link", () => {
    const r = posCheckoutSchema.safeParse({
      ...base,
      customer_id: CUSTOMER_ID,
      customer_name: "Ahmad",
    });
    expect(r.success).toBe(true);
  });
});

describe("computePosTotals", () => {
  it("applies amount discount before SST", () => {
    const t = computePosTotals({
      lineSubtotal: 100,
      discountType: "amount",
      discountValue: 10,
      sstEnabled: true,
      sstRatePct: 6,
    });
    expect(t.subtotal_myr).toBe(100);
    expect(t.discount_amount_myr).toBe(10);
    expect(t.sst_amount_myr).toBe(5.4);
    expect(t.total_myr).toBe(95.4);
  });

  it("caps percent discount at subtotal", () => {
    const t = computePosTotals({
      lineSubtotal: 50,
      discountType: "pct",
      discountValue: 100,
      sstEnabled: false,
      sstRatePct: 0,
    });
    expect(t.discount_amount_myr).toBe(50);
    expect(t.total_myr).toBe(0);
  });
});

describe("buildPosPrefillUrl", () => {
  it("builds customer POS link", () => {
    expect(
      buildPosPrefillUrl({
        customerId: CUSTOMER_ID,
        customerName: "Ali",
      }),
    ).toBe(
      `/sales/pos?customer_id=${CUSTOMER_ID}&customer_name=Ali`,
    );
  });

  it("builds lead POS link before convert", () => {
    const url = buildPosPrefillUrl({
      leadId: "40000000-0000-4000-8000-000000000004",
      leadName: "Siti",
      leadPhone: "+60123456789",
    });
    expect(url).toContain("lead_id=");
    expect(url).toContain("lead_name=Siti");
    expect(url).toContain("lead_phone=%2B60123456789");
  });
});
