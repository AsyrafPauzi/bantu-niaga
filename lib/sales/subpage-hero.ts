import type { ModuleHeroVariant } from "@/components/dashboard/module-layout";
import { formatMyr } from "@/lib/marketing/metrics";
import type { LeadsInsights } from "@/lib/sales/leads-insights";

export function leadsSubpageHero(insights: LeadsInsights): {
  headline: string;
  subcopy: string;
  variant: ModuleHeroVariant;
} {
  if (insights.open === 0) {
    return {
      headline: "Start your lead list",
      subcopy:
        "Capture prospects before they become customers — set follow-ups and convert when you win.",
      variant: "calm",
    };
  }

  if (insights.overdue > 0) {
    return {
      headline: `${insights.overdue} follow-up${insights.overdue === 1 ? "" : "s"} overdue`,
      subcopy: `Chase them today — ${insights.open} open in pipeline${insights.pipelineValueMyr > 0 ? ` · ${formatMyr(insights.pipelineValueMyr)} estimated` : ""}.`,
      variant: "attention",
    };
  }

  if (insights.dueToday > 0) {
    return {
      headline: `${insights.dueToday} due today`,
      subcopy: `${insights.open} open leads — stay on top of follow-ups before they go cold.`,
      variant: "attention",
    };
  }

  return {
    headline: `${insights.open} open lead${insights.open === 1 ? "" : "s"}`,
    subcopy:
      insights.pipelineValueMyr > 0
        ? `Pipeline value ${formatMyr(insights.pipelineValueMyr)} — filter, chase, and convert won deals.`
        : "Filter by status, assign teammates, and convert won leads to customers.",
    variant: "sales",
  };
}

export function historySubpageHero(opts: {
  period: "today" | "week" | "month";
  salesMyr: number;
  txnCount: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const periodLabel =
    opts.period === "today"
      ? "Today"
      : opts.period === "week"
        ? "This week"
        : "This month";

  return {
    headline:
      opts.txnCount === 0
        ? `No sales ${periodLabel.toLowerCase()}`
        : `${formatMyr(opts.salesMyr)} ${periodLabel.toLowerCase()}`,
    subcopy:
      opts.txnCount === 0
        ? "Completed POS receipts appear here — open the counter to ring up."
        : `${opts.txnCount} receipt${opts.txnCount === 1 ? "" : "s"} — tap a row to view or export.`,
    variant: opts.txnCount === 0 ? "calm" : "sales",
  };
}
