import { describe, expect, it } from "vitest";
import { getMessages, messageAt } from "@/lib/i18n/messages";
import { parseAppLocale } from "@/lib/i18n/locale";

describe("tenant i18n messages", () => {
  it("parses locale", () => {
    expect(parseAppLocale("ms")).toBe("ms");
    expect(parseAppLocale("fr")).toBe("en");
  });

  it("requires shell and activation keys in en and ms", () => {
    for (const locale of ["en", "ms"] as const) {
      const messages = getMessages(locale);
      expect(messages.shell.pastDueBanner.length).toBeGreaterThan(0);
      expect(messages.activation.title.length).toBeGreaterThan(0);
      expect(messages.nav.home.length).toBeGreaterThan(0);
    }
  });

  it("falls back to english for unknown path", () => {
    expect(messageAt("ms", "shell.pastDueCta")).toMatch(/Bayar|Pay/i);
  });
});
