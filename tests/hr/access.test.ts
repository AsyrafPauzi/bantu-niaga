import { describe, expect, it } from "vitest";
import { canAccessStaffMe, canManageHrCore } from "@/lib/hr/access";
import { canUseStaffSelfService } from "@/lib/hr/staff-self-service";

describe("canManageHrCore", () => {
  it("allows owner, manager, and HR officer", () => {
    expect(canManageHrCore("owner")).toBe(true);
    expect(canManageHrCore("manager")).toBe(true);
    expect(canManageHrCore("hr_officer")).toBe(true);
  });

  it("denies accountant, cashier, and staff", () => {
    expect(canManageHrCore("accountant")).toBe(false);
    expect(canManageHrCore("cashier")).toBe(false);
    expect(canManageHrCore("staff")).toBe(false);
  });
});

describe("canAccessStaffMe", () => {
  it("allows staff with hr leave self_only", () => {
    expect(canAccessStaffMe("staff")).toBe(true);
  });

  it("denies HR managers and other roles", () => {
    expect(canAccessStaffMe("owner")).toBe(false);
    expect(canAccessStaffMe("manager")).toBe(false);
    expect(canAccessStaffMe("hr_officer")).toBe(false);
    expect(canAccessStaffMe("cashier")).toBe(false);
  });
});

describe("canUseStaffSelfService", () => {
  it("matches staff leave permission", () => {
    expect(canUseStaffSelfService("staff")).toBe(true);
    expect(canUseStaffSelfService("owner")).toBe(false);
  });
});
