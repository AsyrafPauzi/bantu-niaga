import type { AppLocale } from "@/lib/i18n/locale";
import en from "@/messages/en.json";
import ms from "@/messages/ms.json";

const catalogs = { en, ms } as const;

export type MessageCatalog = typeof en;

export function getMessages(locale: AppLocale): MessageCatalog {
  return catalogs[locale] ?? catalogs.en;
}

/** Deep get with English fallback for missing ms keys. */
export function messageAt(
  locale: AppLocale,
  path: string,
): string {
  const keys = path.split(".");
  const pick = (catalog: MessageCatalog): string | undefined => {
    let cur: unknown = catalog;
    for (const key of keys) {
      if (!cur || typeof cur !== "object" || !(key in cur)) return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
    return typeof cur === "string" ? cur : undefined;
  };
  return pick(getMessages(locale)) ?? pick(getMessages("en")) ?? path;
}
