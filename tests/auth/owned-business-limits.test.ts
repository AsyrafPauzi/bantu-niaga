import { describe, expect, it } from "vitest";
import {
  MAX_OWNED_BUSINESSES_PER_USER_SAAS,
  canCreateOwnedBusiness,
  getMaxOwnedBusinessesPerUser,
  ownedBusinessLimitMessage,
} from "@/lib/auth/owned-business-limits";

describe("owned business limits", () => {
  it("allows creation below the cap", () => {
    const max = getMaxOwnedBusinessesPerUser();
    expect(canCreateOwnedBusiness(0)).toBe(true);
    expect(canCreateOwnedBusiness(max - 1)).toBe(true);
  });

  it("blocks at and above the cap", () => {
    const max = getMaxOwnedBusinessesPerUser();
    expect(canCreateOwnedBusiness(max)).toBe(false);
    expect(canCreateOwnedBusiness(max + 1)).toBe(false);
  });

  it("includes the limit in the user message", () => {
    expect(ownedBusinessLimitMessage()).toContain(
      String(MAX_OWNED_BUSINESSES_PER_USER_SAAS),
    );
  });
});
