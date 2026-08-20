"use client";

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n/locale";
import {
  readPreferredLocaleCookie,
  writePreferredLocaleCookie,
} from "@/lib/i18n/preferred-locale-cookie";

/** Cookie-backed locale for unauthenticated auth screens. */
export function useAuthLocale(initial?: AppLocale | null) {
  const [locale, setLocaleState] = useState<AppLocale>(initial ?? "en");

  useEffect(() => {
    if (initial === "en" || initial === "ms") {
      writePreferredLocaleCookie(initial);
      setLocaleState(initial);
      return;
    }
    setLocaleState(readPreferredLocaleCookie());
  }, [initial]);

  function setLocale(next: AppLocale) {
    writePreferredLocaleCookie(next);
    setLocaleState(next);
  }

  return { locale, setLocale };
}
