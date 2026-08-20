import { afterEach, describe, expect, it, vi } from "vitest";
import { assertBillplzConfiguredForPaidCheckout } from "@/lib/settings/require-billplz-prod";

describe("assertBillplzConfiguredForPaidCheckout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when Billplz env missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLPLZ_API_KEY", "");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "");
    expect(() => assertBillplzConfiguredForPaidCheckout()).toThrow(
      /billplz_not_configured|Billplz is not configured/i,
    );
  });

  it("allows non-production without keys", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BILLPLZ_API_KEY", "");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "");
    expect(() => assertBillplzConfiguredForPaidCheckout()).not.toThrow();
  });
});
