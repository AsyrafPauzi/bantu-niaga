import { describe, expect, it } from "vitest";
import {
  getCategoryPresetsForBusiness,
  getOperationsNavSubItems,
  getOperationsVerticalProfile,
  mergeCategoryPresets,
  normalizeBusinessType,
} from "@/lib/operations/vertical";

describe("normalizeBusinessType", () => {
  it("returns other for unknown values", () => {
    expect(normalizeBusinessType(null)).toBe("other");
    expect(normalizeBusinessType("unknown")).toBe("other");
  });

  it("passes through valid types", () => {
    expect(normalizeBusinessType("services")).toBe("services");
  });
});

describe("getOperationsVerticalProfile", () => {
  it("prioritises services and bookings for service businesses", () => {
    const profile = getOperationsVerticalProfile("services");
    expect(profile.showServices).toBe(true);
    expect(profile.showProducts).toBe(false);
    expect(profile.navItems[0]?.href).toBe("/operations/bookings");
    expect(profile.navItems.some((i) => i.href === "/operations/services")).toBe(
      true,
    );
    expect(profile.bundleId).toBe("pakej-servis");
  });

  it("includes apparel presets for retail", () => {
    const presets = getCategoryPresetsForBusiness("retail");
    expect(presets).toContain("Apparel");
    expect(presets).toContain("Footwear");
  });

  it("includes food presets for fnb", () => {
    const presets = getCategoryPresetsForBusiness("fnb");
    expect(presets).toContain("Food");
    expect(presets).toContain("Catering");
  });
});

describe("getOperationsNavSubItems", () => {
  it("includes Services for service businesses", () => {
    const items = getOperationsNavSubItems("services");
    expect(items.map((i) => i.label)).toContain("Services");
  });

  it("omits Services from retail nav order before bookings", () => {
    const items = getOperationsNavSubItems("retail");
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("Services");
    expect(labels.indexOf("Products")).toBeLessThan(
      labels.indexOf("Bookings"),
    );
  });
});

describe("mergeCategoryPresets", () => {
  it("merges and sorts unique categories", () => {
    expect(
      mergeCategoryPresets(["Food", "Drinks"], ["Catering", "Food"]),
    ).toEqual(["Catering", "Drinks", "Food"]);
  });
});
