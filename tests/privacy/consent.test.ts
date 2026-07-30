import { describe, expect, it } from "vitest";

import { resolveConsentGranted } from "@/lib/privacy/consent";

describe("resolveConsentGranted", () => {
  it("uses stored value when a row exists", () => {
    expect(resolveConsentGranted("marketing_email", { granted: false })).toBe(
      false,
    );
    expect(resolveConsentGranted("analytics", { granted: true })).toBe(true);
  });

  it("falls back to catalog defaults when no row exists", () => {
    expect(resolveConsentGranted("marketing_email", null)).toBe(false);
    expect(resolveConsentGranted("product_updates", null)).toBe(true);
    expect(resolveConsentGranted("terms_of_service", null)).toBe(true);
  });
});
