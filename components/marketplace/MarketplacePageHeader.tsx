"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";

export function MarketplacePageHeader({
  canEdit,
  planLabel,
}: {
  canEdit: boolean;
  planLabel: string;
}) {
  const t = useTranslations("marketplace");
  return (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      action={
        canEdit ? (
          <Badge tone="brand">{t("planBadge", { plan: planLabel })}</Badge>
        ) : (
          <Badge tone="warning">{t("readOnly")}</Badge>
        )
      }
    />
  );
}
