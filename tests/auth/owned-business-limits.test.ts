import { describe, expect, it } from "vitest";
import {
  MAX_OWNED_BUSINESSES_PER_USER,
  canCreateOwnedBusiness,
  ownedBusinessLimitMessage,
} from "@/lib/auth/owned-business-limits";

describe("owned business limits", () => {
  it("allows creation below the cap", () => {
    expect(canCreateOwnedBusiness(0)).toBe(true);
    expect(canCreateOwnedBusiness(MAX_OWNED_BUSINESSES_PER_USER - 1)).toBe(true);
  });

  it("blocks at and above the cap", () => {
    expect(canCreateOwnedBusiness(MAX_OWNED_BUSINESSES_PER_USER)).toBe(false);
    expect(canCreateOwnedBusiness(MAX_OWNED_BUSINESSES_PER_USER + 1)).toBe(
      false,
    );
  });

  it("includes the limit in the user message", () => {
    expect(ownedBusinessLimitMessage()).toContain(
      String(MAX_OWNED_BUSINESSES_PER_USER),
    );
  });
});
