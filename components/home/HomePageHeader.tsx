"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";

export function HomePageHeader({
  weekday,
  greeting,
  displayName,
}: {
  weekday: string;
  greeting: string;
  displayName: string;
}) {
  const t = useTranslations("home");
  return (
    <PageHeader
      eyebrow={weekday}
      title={`${greeting}, ${displayName}`}
      description={t("pulse")}
      action={
        <Link
          href="/boardroom"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          {t("openBoardroom")}
        </Link>
      }
    />
  );
}
