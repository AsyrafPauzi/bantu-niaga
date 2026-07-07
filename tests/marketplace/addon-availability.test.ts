import { describe, expect, it } from "vitest";
import { isAddonPurchasable } from "@/lib/marketplace/addon-availability";

describe("addon availability", () => {
  it("treats coming soon add-ons as not purchasable", () => {
    expect(isAddonPurchasable({ is_coming_soon: true })).toBe(false);
    expect(isAddonPurchasable({ is_coming_soon: false })).toBe(true);
  });
});
