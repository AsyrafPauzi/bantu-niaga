import { describe, expect, it } from "vitest";
import {
  parseEmailLocaleHint,
  resolvePreferredLocale,
} from "@/lib/email/resolve-locale";

function fakeAdmin(row: { preferred_locale?: unknown } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  };
}

describe("parseEmailLocaleHint", () => {
  it("accepts only en and ms", () => {
    expect(parseEmailLocaleHint("en")).toBe("en");
    expect(parseEmailLocaleHint("ms")).toBe("ms");
    expect(parseEmailLocaleHint("fr")).toBeNull();
    expect(parseEmailLocaleHint("")).toBeNull();
    expect(parseEmailLocaleHint(undefined)).toBeNull();
  });
});

describe("resolvePreferredLocale", () => {
  it("uses the profile row when it is en or ms", async () => {
    const admin = fakeAdmin({ preferred_locale: "ms" });
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "en"),
    ).resolves.toBe("ms");
  });

  it("uses the metadata hint when there is no profile row", async () => {
    const admin = fakeAdmin(null);
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "ms"),
    ).resolves.toBe("ms");
  });

  it("falls back to en when neither profile nor hint is valid", async () => {
    const admin = fakeAdmin(null);
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "fr"),
    ).resolves.toBe("en");
    await expect(
      resolvePreferredLocale(admin as never, "user-1"),
    ).resolves.toBe("en");
  });
});
