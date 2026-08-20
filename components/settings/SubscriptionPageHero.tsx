"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { SettingsPageHero } from "@/components/settings/SettingsPageHero";

export function SubscriptionPageHero() {
  const t = useTranslations("settings");
  return (
    <SettingsPageHero
      eyebrow={t("subscriptionPageEyebrow")}
      title={t("subscriptionPageTitle")}
      subcopy={
        t("subscriptionDesc")
      }
      cta={
        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
        >
          <Receipt className="h-4 w-4" strokeWidth={2} />
          {t("billingTitle")}
        </Link>
      }
    />
  );
}
