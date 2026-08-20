import { describe, expect, it } from "vitest";
import { staffPortalIncludedForTier } from "@/lib/marketplace/staff-portal-entitlement";

describe("staffPortalIncludedForTier", () => {
  it("is true for Solo+", () => {
    expect(staffPortalIncludedForTier("micro")).toBe(true);
    expect(staffPortalIncludedForTier("sme")).toBe(true);
    expect(staffPortalIncludedForTier("enterprise")).toBe(true);
  });

  it("is false for Free/Basic", () => {
    expect(staffPortalIncludedForTier("starter")).toBe(false);
    expect(staffPortalIncludedForTier("basic")).toBe(false);
  });
});
