import { describe, expect, it } from "vitest";
import { buildCustomersExportUrl } from "@/lib/marketing/customers-export-url";

describe("buildCustomersExportUrl", () => {
  it("returns base export path when no filters", () => {
    expect(buildCustomersExportUrl({})).toBe(
      "/api/marketing/customers/csv-export",
    );
  });

  it("preserves search and tag filters", () => {
    const url = buildCustomersExportUrl({
      q: "ali",
      tags: "vip,dormant",
      source: "pos",
    });
    expect(url).toContain("q=ali");
    expect(url).toContain("tags=vip%2Cdormant");
    expect(url).toContain("source=pos");
  });

  it("preserves spend range filters", () => {
    const url = buildCustomersExportUrl({
      min_spend: "100",
      max_spend: "5000",
    });
    expect(url).toContain("min_spend=100");
    expect(url).toContain("max_spend=5000");
  });

  it("preserves selected customer ids", () => {
    const url = buildCustomersExportUrl({
      ids: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee,ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj",
    });
    expect(url).toContain("ids=");
    expect(url).toContain("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});
