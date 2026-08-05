import { describe, expect, it } from "vitest";
import {
  buildSettingsNavGroups,
  shouldShowPlanAndBilling,
} from "@/lib/settings/nav";

describe("shouldShowPlanAndBilling", () => {
  it("shows for all roles in SaaS mode", () => {
    expect(shouldShowPlanAndBilling(false, "owner")).toBe(true);
    expect(shouldShowPlanAndBilling(false, "manager")).toBe(true);
    expect(shouldShowPlanAndBilling(false, "staff")).toBe(true);
  });

  it("shows for owner only in standalone mode", () => {
    expect(shouldShowPlanAndBilling(true, "owner")).toBe(true);
    expect(shouldShowPlanAndBilling(true, "manager")).toBe(false);
    expect(shouldShowPlanAndBilling(true, "staff")).toBe(false);
  });
});

describe("buildSettingsNavGroups", () => {
  it("includes plan group for owner in standalone", () => {
    const groups = buildSettingsNavGroups(true, "owner");
    const plan = groups.find((g) => g.title === "Plan & billing");
    expect(plan?.items.some((i) => i.href === "/settings/subscription")).toBe(
      true,
    );
  });

    it("includes business profile in workspace", () => {
    const groups = buildSettingsNavGroups(true, "owner");
    const workspace = groups.find((g) => g.title === "Workspace");
    expect(
      workspace?.items.some((i) => i.href === "/settings/business"),
    ).toBe(true);
  });

  it("omits plan group for staff in standalone", () => {
    const groups = buildSettingsNavGroups(true, "staff");
    expect(groups.some((g) => g.title === "Plan & billing")).toBe(false);
  });
});
