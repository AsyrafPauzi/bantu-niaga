import { describe, expect, it } from "vitest";
import {
  canManageSalesCore,
  canUseLeads,
  canUsePos,
  canUseSalesAssistant,
} from "@/lib/sales/access";

describe("sales access", () => {
  it("allows owner full sales surfaces", () => {
    expect(canUsePos("owner")).toBe(true);
    expect(canUseLeads("owner")).toBe(true);
    expect(canManageSalesCore("owner")).toBe(true);
    expect(canUseSalesAssistant("owner")).toBe(true);
  });

  it("allows cashier POS but not leads or Sufi", () => {
    expect(canUsePos("cashier")).toBe(true);
    expect(canUseLeads("cashier")).toBe(false);
    expect(canUseSalesAssistant("cashier")).toBe(false);
    expect(canManageSalesCore("cashier")).toBe(true);
  });

  it("allows sales_rep leads and assistant but not POS checkout role", () => {
    expect(canUseLeads("sales_rep")).toBe(true);
    expect(canUseSalesAssistant("sales_rep")).toBe(true);
    expect(canManageSalesCore("sales_rep")).toBe(true);
  });
});
