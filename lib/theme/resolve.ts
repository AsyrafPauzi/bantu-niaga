import type { ResolvedTheme, ThemePreference } from "./types";

/**
 * Collapse a user `preference` and the OS-level `prefersDark` signal into the
 * concrete theme that should actually render. Pure function — safe for both
 * the no-flash inline script's mental model and unit tests.
 */
export function resolveTheme(
  pref: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (pref === "dark") return "dark";
  if (pref === "system" && prefersDark) return "dark";
  return "light";
}
