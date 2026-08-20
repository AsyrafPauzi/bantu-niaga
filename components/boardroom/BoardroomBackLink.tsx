"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

export function BoardroomBackLink() {
  const t = useTranslations("boardroom");
  return (
    <Link
      href="/home"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {t("backHome")}
    </Link>
  );
}
