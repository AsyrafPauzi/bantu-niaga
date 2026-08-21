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
      action={undefined}
    />
  );
}
