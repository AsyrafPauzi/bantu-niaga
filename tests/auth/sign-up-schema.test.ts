import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/auth/schemas";

const valid = {
  email: "owner@example.test",
  password: "CorrectHorse1x",
  business_name: "Kedai Contoh",
  state_code: "KUL" as const,
  accept_terms: true as const,
  signup_path: "free" as const,
  preferred_locale: "en" as const,
};

describe("signUpSchema preferred_locale", () => {
  it("accepts en and ms", () => {
    expect(signUpSchema.parse(valid).preferred_locale).toBe("en");
    expect(
      signUpSchema.parse({ ...valid, preferred_locale: "ms" }).preferred_locale,
    ).toBe("ms");
  });

  it("rejects missing preferred_locale", () => {
    const { preferred_locale: _locale, ...rest } = valid;
    expect(signUpSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects fr and extra keys", () => {
    expect(
      signUpSchema.safeParse({ ...valid, preferred_locale: "fr" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...valid, preferred_locale: "en", role: "owner" })
        .success,
    ).toBe(false);
  });
});
