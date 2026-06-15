/**
 * Unit tests for lib/marketing/broadcasts.ts pure helpers.
 *
 * Covers:
 *   - renderTemplate (all placeholders, missing fields, special chars,
 *     repeated occurrences)
 *   - buildCtcUrl  (Malaysian + foreign phones, special chars in the
 *     prefilled message)
 *
 * No DB / network — these are CPU-only.
 */
import { describe, expect, it } from "vitest";
import { buildCtcUrl, renderTemplate } from "@/lib/marketing/broadcasts";

describe("renderTemplate", () => {
  it("substitutes all three placeholders", () => {
    const out = renderTemplate(
      "Hi {first_name}, your code is {coupon_code}. ({name})",
      { name: "Aida Binti Hassan" },
      { code: "RAYA20" },
    );
    expect(out).toBe("Hi Aida, your code is RAYA20. (Aida Binti Hassan)");
  });

  it("uses first whitespace-split token for {first_name}", () => {
    const out = renderTemplate("Hi {first_name}!", { name: "Wong Wei Ling" });
    expect(out).toBe("Hi Wong!");
  });

  it("single-name customer: {first_name} == {name}", () => {
    const out = renderTemplate("{first_name} / {name}", { name: "Asyraf" });
    expect(out).toBe("Asyraf / Asyraf");
  });

  it("missing coupon → empty string substitution", () => {
    const out = renderTemplate("Use {coupon_code} at checkout.", {
      name: "Test",
    });
    expect(out).toBe("Use  at checkout.");
  });

  it("missing name field → empty string for both name and first_name", () => {
    const out = renderTemplate(
      "Hi {first_name} ({name}), code {coupon_code}",
      { name: "" },
      { code: "X" },
    );
    expect(out).toBe("Hi  (), code X");
  });

  it("preserves non-placeholder braces and emoji", () => {
    const out = renderTemplate(
      "Hi {first_name} 🎉 (curly: {not_a_token})",
      { name: "Siti" },
    );
    expect(out).toBe("Hi Siti 🎉 (curly: {not_a_token})");
  });

  it("repeated placeholder is replaced everywhere", () => {
    const out = renderTemplate("{name}/{name}/{name}", { name: "Ali" });
    expect(out).toBe("Ali/Ali/Ali");
  });

  it("special characters in name are left as-is (plain text)", () => {
    const out = renderTemplate(
      "Welcome, {name}!",
      { name: "O'Malley & Sons <Trading>" },
    );
    expect(out).toBe("Welcome, O'Malley & Sons <Trading>!");
  });
});

describe("buildCtcUrl", () => {
  it("strips leading + from Malaysian E.164 phone", () => {
    expect(buildCtcUrl("+60123456789", "Hi")).toBe(
      "https://wa.me/60123456789?text=Hi",
    );
  });

  it("works for foreign phones (US, SG, UK)", () => {
    expect(buildCtcUrl("+12025550100", "hi")).toBe(
      "https://wa.me/12025550100?text=hi",
    );
    expect(buildCtcUrl("+6591234567", "hi")).toBe(
      "https://wa.me/6591234567?text=hi",
    );
    expect(buildCtcUrl("+447911123456", "hi")).toBe(
      "https://wa.me/447911123456?text=hi",
    );
  });

  it("URL-encodes spaces and punctuation in the message", () => {
    const out = buildCtcUrl("+60123456789", "Hi, friend! 20% off?");
    expect(out).toBe(
      "https://wa.me/60123456789?text=Hi%2C%20friend!%2020%25%20off%3F",
    );
  });

  it("URL-encodes newlines and emoji in the message", () => {
    const out = buildCtcUrl("+60123456789", "Line1\nLine2 🎉");
    expect(out).toContain("https://wa.me/60123456789?text=");
    // Decoding it round-trips back to the original message.
    const text = decodeURIComponent(out.split("?text=")[1]);
    expect(text).toBe("Line1\nLine2 🎉");
  });

  it("leaves a phone without a leading + alone", () => {
    expect(buildCtcUrl("60123456789", "Hi")).toBe(
      "https://wa.me/60123456789?text=Hi",
    );
  });
});
