import { createTranslator } from "next-intl";
import type { AppLocale } from "@/lib/i18n/locale";
import { getMessages, type MessageCatalog } from "@/lib/i18n/messages";

export function createAppTranslator(locale: AppLocale) {
  return createTranslator({
    locale,
    messages: getMessages(locale),
  });
}

export type { MessageCatalog };
