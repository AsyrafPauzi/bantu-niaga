import { describe, expect, it } from "vitest";
import { profileUpdateSchema } from "@/lib/settings/schemas";

describe("profileUpdateSchema locale", () => {
  it("accepts en and ms", () => {
    expect(profileUpdateSchema.parse({ preferred_locale: "ms" }).preferred_locale).toBe(
      "ms",
    );
    expect(profileUpdateSchema.parse({ preferred_locale: "en" }).preferred_locale).toBe(
      "en",
    );
  });

  it("rejects other locales", () => {
    expect(() => profileUpdateSchema.parse({ preferred_locale: "fr" })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      profileUpdateSchema.parse({ preferred_locale: "en", role: "owner" }),
    ).toThrow();
  });
});
