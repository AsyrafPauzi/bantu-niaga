import { createTranslator } from "next-intl";
import type { AppLocale } from "@/lib/i18n/locale";
import { getMessages, type MessageCatalog } from "@/lib/i18n/messages";

/** Server-side translator — no next-intl plugin / request config required. */
export function createAppTranslator(locale: AppLocale) {
  return createTranslator({
    locale,
    messages: getMessages(locale),
  });
}

type MessageNamespace = Extract<keyof MessageCatalog, string>;

/** Same as createAppTranslator, scoped to one messages namespace (e.g. "finance"). */
export function createNamespacedTranslator(
  locale: AppLocale,
  namespace: MessageNamespace,
) {
  return createTranslator({
    locale,
    messages: getMessages(locale),
    namespace,
  });
}

export type { MessageCatalog };
