import { describe, expect, it } from "vitest";
import { canUseAdminAssistant } from "@/lib/admin/access";

describe("canUseAdminAssistant", () => {
  it("allows owner and manager", () => {
    expect(canUseAdminAssistant("owner")).toBe(true);
    expect(canUseAdminAssistant("manager")).toBe(true);
  });

  it("denies staff and specialist roles", () => {
    expect(canUseAdminAssistant("staff")).toBe(false);
    expect(canUseAdminAssistant("accountant")).toBe(false);
    expect(canUseAdminAssistant("cashier")).toBe(false);
    expect(canUseAdminAssistant("hr_officer")).toBe(false);
  });
});
