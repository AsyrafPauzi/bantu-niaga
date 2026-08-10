import Link from "next/link";
import { Download } from "lucide-react";
import type { HrPayslipRow } from "@/lib/hr/payslips";
import { formatPayslipPeriodLabel } from "@/lib/hr/payslips";
import { formatMyr } from "@/lib/finance/schemas";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export function HrPayslipList({
  items,
  showEmployee = true,
}: {
  items: HrPayslipRow[];
  showEmployee?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-muted dark:text-cream-400">
        No payslips yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            {showEmployee ? (
              <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                {item.hr_employees?.full_name ?? "Employee"}
              </p>
            ) : null}
            <p className="text-sm text-ink dark:text-cream-100">
              {formatPayslipPeriodLabel(item.period_start)}
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {fmtDate(item.period_start)} – {fmtDate(item.period_end)} · Net{" "}
              {formatMyr(item.net_myr)}
            </p>
          </div>
          <Link
            href={`/api/hr/payslips/${encodeURIComponent(item.id)}/pdf`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-cream-50 dark:border-hairline-dark dark:text-brand-200 dark:hover:bg-panel-dark"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            PDF
          </Link>
        </li>
      ))}
    </ul>
  );
}
