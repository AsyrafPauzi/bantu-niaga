"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { pillarClasses } from "@/lib/pillars/theme";

const financeTheme = pillarClasses.finance;

export function FinanceNewInvoiceButton({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("finance");
  return (
    <Link
      href="/finance/invoices/new"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
        financeTheme.btnPrimary,
        className,
      )}
    >
      <Plus className="h-4 w-4" strokeWidth={2} />
      {t("newInvoice")}
    </Link>
  );
}
