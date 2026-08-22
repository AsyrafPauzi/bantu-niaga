import { describe, expect, it } from "vitest";
import {
  buildAppNavGroups,
  filterAppNavGroupsForRole,
} from "@/lib/navigation/app-nav";

describe("filterAppNavGroupsForRole", () => {
  const groups = buildAppNavGroups("other");

  it("keeps all module pillars for owner", () => {
    const filtered = filterAppNavGroupsForRole(groups, "owner");
    const modules = filtered.find((g) => g.label === "Modules")?.items ?? [];
    expect(modules.map((i) => i.href)).toEqual([
      "/admin",
      "/finance",
      "/operations",
      "/marketing",
      "/sales",
      "/hr",
    ]);
  });

  it("shows finance only for accountant", () => {
    const filtered = filterAppNavGroupsForRole(groups, "accountant");
    const modules = filtered.find((g) => g.label === "Modules")?.items ?? [];
    expect(modules.map((i) => i.href)).toEqual(["/finance"]);
  });

  it("rewrites staff HR and Admin to self-service routes", () => {
    const filtered = filterAppNavGroupsForRole(groups, "staff");
    const modules = filtered.find((g) => g.label === "Modules")?.items ?? [];
    expect(modules.map((i) => i.href).sort()).toEqual([
      "/admin/tasks",
      "/hr/me",
    ]);
  });

  it("limits cashier sales to POS", () => {
    const filtered = filterAppNavGroupsForRole(groups, "cashier");
    const modules = filtered.find((g) => g.label === "Modules")?.items ?? [];
    expect(modules).toHaveLength(1);
    expect(modules[0]?.href).toBe("/sales/pos");
  });

  it("hides boardroom for staff", () => {
    const filtered = filterAppNavGroupsForRole(groups, "staff");
    const platform = filtered.find((g) => g.label === "Platform")?.items ?? [];
    expect(platform.map((i) => i.href)).toEqual(["/settings"]);
  });
});
