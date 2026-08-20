"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function PastDueBanner({
  checkoutHref = "/settings/subscription",
}: {
  checkoutHref?: string;
}) {
  const t = useTranslations("shell");
  return (
    <div
      role="alert"
      className="border-b border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-ink dark:text-cream-100"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p>{t("pastDueBanner")}</p>
        <Link
          href={checkoutHref}
          className="font-semibold text-status-danger underline-offset-2 hover:underline"
        >
          {t("pastDueCta")}
        </Link>
      </div>
    </div>
  );
}
