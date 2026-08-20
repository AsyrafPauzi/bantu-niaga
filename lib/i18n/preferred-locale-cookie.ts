import type { AppLocale } from "@/lib/i18n/locale";
import { parseAppLocale } from "@/lib/i18n/locale";

export const PREFERRED_LOCALE_COOKIE = "nx_preferred_locale";

export function readPreferredLocaleCookie(): AppLocale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${PREFERRED_LOCALE_COOKIE}=`));
  if (!match) return "en";
  return parseAppLocale(decodeURIComponent(match.split("=")[1] ?? ""));
}

export function writePreferredLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${PREFERRED_LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${maxAge}; samesite=lax`;
}
