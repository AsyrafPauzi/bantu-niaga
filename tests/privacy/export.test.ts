import { describe, expect, it } from "vitest";

import {
  categoriesForScope,
  isCategoryAllowedForScope,
} from "@/lib/privacy/export-catalog";
import { requestExportSchema } from "@/lib/privacy/schemas";

describe("requestExportSchema", () => {
  it("defaults to personal scope with all personal categories when omitted", () => {
    const parsed = requestExportSchema.parse({});
    expect(parsed.scope).toBe("personal");
    expect(parsed.categories).toBeUndefined();
  });

  it("accepts business scope with selected categories", () => {
    const parsed = requestExportSchema.parse({
      scope: "business",
      categories: ["finance", "operations"],
    });
    expect(parsed.scope).toBe("business");
    expect(parsed.categories).toEqual(["finance", "operations"]);
  });
});

describe("export catalog helpers", () => {
  it("lists six personal categories", () => {
    expect(categoriesForScope("personal")).toHaveLength(6);
  });

  it("lists ten business categories", () => {
    expect(categoriesForScope("business")).toHaveLength(10);
  });

  it("rejects cross-scope categories", () => {
    expect(isCategoryAllowedForScope("finance", "personal")).toBe(false);
    expect(isCategoryAllowedForScope("profile", "business")).toBe(false);
    expect(isCategoryAllowedForScope("finance", "business")).toBe(true);
  });
});
