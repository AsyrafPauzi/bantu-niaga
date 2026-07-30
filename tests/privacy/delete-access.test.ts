import { describe, expect, it } from "vitest";

import { canScheduleDeletionScope } from "@/lib/privacy/delete-access";

describe("canScheduleDeletionScope", () => {
  it("allows any role to close their own user account", () => {
    expect(canScheduleDeletionScope("manager", "user")).toBe(true);
    expect(canScheduleDeletionScope("cashier", "user")).toBe(true);
    expect(canScheduleDeletionScope("owner", "user")).toBe(true);
  });

  it("allows only owner to close the entire business", () => {
    expect(canScheduleDeletionScope("owner", "business")).toBe(true);
    expect(canScheduleDeletionScope("manager", "business")).toBe(false);
    expect(canScheduleDeletionScope("cashier", "business")).toBe(false);
    expect(canScheduleDeletionScope("marketing_officer", "business")).toBe(false);
  });
});
