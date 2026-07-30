import { describe, expect, it, afterEach } from "vitest";
import {
  isFinanceBillplzCheckoutEnabled,
  isFinanceBillplzWebhookEnabled,
} from "@/lib/finance/billplz-checkout";

describe("finance billplz gates", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("checkout disabled without API key and collection", () => {
    delete process.env.BILLPLZ_API_KEY;
    delete process.env.BILLPLZ_COLLECTION_ID;
    delete process.env.BILLPLZ_X_SIGNATURE_KEY;
    expect(isFinanceBillplzCheckoutEnabled()).toBe(false);
    expect(isFinanceBillplzWebhookEnabled()).toBe(false);
  });

  it("checkout enabled with API key and collection", () => {
    process.env.BILLPLZ_API_KEY = "key";
    process.env.BILLPLZ_COLLECTION_ID = "col";
    delete process.env.BILLPLZ_X_SIGNATURE_KEY;
    expect(isFinanceBillplzCheckoutEnabled()).toBe(true);
    expect(isFinanceBillplzWebhookEnabled()).toBe(false);
  });

  it("webhook enabled when signature key is set", () => {
    process.env.BILLPLZ_API_KEY = "key";
    process.env.BILLPLZ_COLLECTION_ID = "col";
    process.env.BILLPLZ_X_SIGNATURE_KEY = "sig";
    expect(isFinanceBillplzWebhookEnabled()).toBe(true);
  });
});
