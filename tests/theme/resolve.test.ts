import { describe, expect, it } from "vitest";
import { resolveTheme } from "@/lib/theme/resolve";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme/types";

describe("resolveTheme", () => {
  const cases: ReadonlyArray<{
    pref: ThemePreference;
    prefersDark: boolean;
    expected: ResolvedTheme;
  }> = [
    { pref: "light", prefersDark: false, expected: "light" },
    { pref: "light", prefersDark: true, expected: "light" },
    { pref: "dark", prefersDark: false, expected: "dark" },
    { pref: "dark", prefersDark: true, expected: "dark" },
    { pref: "system", prefersDark: false, expected: "light" },
    { pref: "system", prefersDark: true, expected: "dark" },
  ];

  for (const { pref, prefersDark, expected } of cases) {
    it(`pref=${pref}, prefersDark=${prefersDark} -> ${expected}`, () => {
      expect(resolveTheme(pref, prefersDark)).toBe(expected);
    });
  }
});
