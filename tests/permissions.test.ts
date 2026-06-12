import { describe, expect, it } from "vitest";
import {
  can,
  canSurface,
  getSurfaceScope,
  hasFullAccess,
} from "@/lib/permissions";

describe("permissions — positive (each role can access its primary surface)", () => {
  it("owner has billing access", () => {
    expect(can("owner", "billing")).toBe(true);
  });

  it("manager has operations access", () => {
    expect(can("manager", "operations")).toBe(true);
  });

  it("accountant has finance access", () => {
    expect(can("accountant", "finance")).toBe(true);
  });

  it("hr_officer has hr access", () => {
    expect(can("hr_officer", "hr")).toBe(true);
  });

  it("cashier has sales/pos surface (and only pos)", () => {
    expect(canSurface("cashier", "sales", "pos")).toBe(true);
    expect(canSurface("cashier", "sales", "leads")).toBe(false);
  });

  it("staff has admin/tasks surface (and only tasks)", () => {
    expect(canSurface("staff", "admin", "tasks")).toBe(true);
    expect(canSurface("staff", "admin", "settings")).toBe(false);
  });
});

describe("permissions — negative (each role is denied a forbidden area)", () => {
  it("cashier is denied finance", () => {
    expect(can("cashier", "finance")).toBe(false);
  });

  it("staff is denied billing", () => {
    expect(can("staff", "billing")).toBe(false);
  });

  it("accountant is denied hr", () => {
    expect(can("accountant", "hr")).toBe(false);
  });

  it("hr_officer is denied finance", () => {
    expect(can("hr_officer", "finance")).toBe(false);
  });

  it("manager is denied billing", () => {
    expect(can("manager", "billing")).toBe(false);
  });

  it("accountant is denied operations", () => {
    expect(can("accountant", "operations")).toBe(false);
  });
});

describe("permissions — cross-cutting invariants", () => {
  it("owner has full access to finance", () => {
    expect(hasFullAccess("owner", "finance")).toBe(true);
  });

  it("manager does not have full access to billing", () => {
    expect(hasFullAccess("manager", "billing")).toBe(false);
  });
});

describe("getSurfaceScope", () => {
  it("returns '*' for full pillar access", () => {
    expect(getSurfaceScope("owner", "finance", "anything")).toBe("*");
  });

  it("returns null for no access", () => {
    expect(getSurfaceScope("cashier", "finance", "ledger")).toBeNull();
  });

  it("returns the raw scope string for nested access", () => {
    expect(getSurfaceScope("cashier", "sales", "pos")).toBe("rw");
    expect(getSurfaceScope("staff", "admin", "tasks")).toBe("assigned_only");
    expect(getSurfaceScope("staff", "hr", "leave")).toBe("self_only");
    expect(getSurfaceScope("hr_officer", "admin", "storage")).toBe(
      "rw_hr_docs_only",
    );
  });

  it("returns null for an unknown surface within a partially-scoped pillar", () => {
    expect(getSurfaceScope("cashier", "sales", "reports")).toBeNull();
  });
});
