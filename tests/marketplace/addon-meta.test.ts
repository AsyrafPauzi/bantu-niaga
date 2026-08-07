import { describe, expect, it } from "vitest";
import {
  isAddonFeatureAccessible,
  isAddonFeatureDisabled,
} from "@/lib/marketplace/addon-meta";
import type { BusinessAddon } from "@/lib/marketplace/types";

function row(
  overrides: Partial<BusinessAddon> = {},
): BusinessAddon {
  return {
    id: "1",
    business_id: "b1",
    addon_id: "a1",
    status: "active",
    activated_at: "2026-01-01T00:00:00Z",
    next_charge_at: "2026-02-01T00:00:00Z",
    cancel_at: null,
    qty: 1,
    meta: {},
    ...overrides,
  };
}

describe("addon meta feature toggle", () => {
  it("disabled meta blocks feature access but keeps billing row", () => {
    const activation = row({ meta: { feature_disabled: true } });
    expect(isAddonFeatureDisabled(activation)).toBe(true);
    expect(isAddonFeatureAccessible(activation)).toBe(false);
    expect(activation.status).toBe("active");
  });

  it("pending cancel stays accessible until cancel_at", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const activation = row({
      status: "pending_cancel",
      cancel_at: future,
    });
    expect(isAddonFeatureAccessible(activation)).toBe(true);
  });
});
