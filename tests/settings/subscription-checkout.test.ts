import { describe, expect, it } from "vitest";
import {
  subscriptionBillDescription,
  tierAmountMyr,
} from "@/lib/settings/subscription-billing";

describe("subscription checkout helpers", () => {
  it("prices match list", () => {
    expect(tierAmountMyr("basic")).toBe(39);
    expect(tierAmountMyr("micro")).toBe(79);
    expect(tierAmountMyr("sme")).toBe(169);
    expect(tierAmountMyr("enterprise")).toBe(299);
  });

  it("builds bill description", () => {
    expect(subscriptionBillDescription("basic")).toMatch(/Basic/i);
    expect(subscriptionBillDescription("micro")).toMatch(/Solo/i);
  });
});
