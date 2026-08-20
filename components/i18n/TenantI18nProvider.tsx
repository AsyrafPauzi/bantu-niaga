"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { AppLocale } from "@/lib/i18n/locale";
import type { MessageCatalog } from "@/lib/i18n/messages";

export function TenantI18nProvider({
  locale,
  messages,
  children,
}: {
  locale: AppLocale;
  messages: MessageCatalog;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Kuala_Lumpur"
    >
      {children}
    </NextIntlClientProvider>
  );
}
