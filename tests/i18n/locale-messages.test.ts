import { describe, expect, it } from "vitest";
import { getMessages, messageAt } from "@/lib/i18n/messages";
import { parseAppLocale } from "@/lib/i18n/locale";
import en from "@/messages/en.json";
import ms from "@/messages/ms.json";

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.push(path);
    else out.push(...collectKeys(value, path));
  }
  return out;
}

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
      expect(messages.auth.signIn.length).toBeGreaterThan(0);
      expect(messages.settings.subscriptionTitle.length).toBeGreaterThan(0);
    }
  });

  it("keeps en and ms key trees in sync", () => {
    const enKeys = collectKeys(en).sort();
    const msKeys = collectKeys(ms).sort();
    expect(msKeys).toEqual(enKeys);
  });

  it("falls back to english for unknown path", () => {
    expect(messageAt("ms", "shell.pastDueCta")).toMatch(/Bayar|Pay/i);
  });
});
