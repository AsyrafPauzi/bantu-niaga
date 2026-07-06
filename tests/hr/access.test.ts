import { describe, expect, it } from "vitest";
import { canManageHrCore } from "@/lib/hr/access";

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
