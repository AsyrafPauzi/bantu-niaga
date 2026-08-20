import { describe, expect, it } from "vitest";
import { activationWithinSevenDaysRate } from "@/lib/home/activation-checklist";

describe("activationWithinSevenDaysRate", () => {
  it("counts paid businesses activated within 7 days", () => {
    const paid = "2026-08-01T00:00:00.000Z";
    const result = activationWithinSevenDaysRate([
      { first_paid_at: paid, activated_at: "2026-08-03T00:00:00.000Z" },
      { first_paid_at: paid, activated_at: "2026-08-20T00:00:00.000Z" },
      { first_paid_at: null, activated_at: null },
    ]);
    expect(result.eligible).toBe(2);
    expect(result.activated).toBe(1);
    expect(result.ratePct).toBe(50);
  });
});
