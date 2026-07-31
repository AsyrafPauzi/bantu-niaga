import { TagBadge } from "@/components/marketing/TagBadge";
import { cn } from "@/lib/utils/cn";
import type { CustomerFullRow } from "./types";
import {
  CUSTOMER_SOURCE_LABEL,
  customerInitials,
  fmtCustomerDate,
} from "@/lib/marketing/customer-detail-format";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";

interface CustomerProfileMobileProps {
  customer: CustomerFullRow;
  className?: string;
}

export function CustomerProfileMobile({
  customer,
  className,
}: CustomerProfileMobileProps) {
  const totalSpend =
    typeof customer.total_spend_myr === "number"
      ? customer.total_spend_myr
      : Number(customer.total_spend_myr) || 0;
  const aov =
    customer.aov_myr != null
      ? typeof customer.aov_myr === "number"
        ? customer.aov_myr
        : Number(customer.aov_myr) || 0
      : customer.order_count > 0
        ? totalSpend / customer.order_count
        : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <section className="overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold uppercase text-white">
              {customerInitials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-ink dark:text-cream-100">
                {customer.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-1">
                {(customer.auto_tags ?? []).map((t) => (
                  <TagBadge key={`m-a-${t}`} label={t} kind="auto" />
                ))}
                {(customer.manual_tags ?? []).map((t) => (
                  <TagBadge key={`m-m-${t}`} label={t} kind="manual" />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Spend" value={formatMyr(totalSpend)} />
            <Stat label="Orders" value={formatCount(customer.order_count)} />
            <Stat label="AOV" value={formatMyr(aov)} />
            <Stat
              label="Last buy"
              value={
                customer.last_purchase_at
                  ? fmtCustomerDate(customer.last_purchase_at)
                  : "—"
              }
            />
          </div>
        </div>

        <div className="border-t border-violet-200/60 bg-white/60 px-4 py-3 text-sm dark:border-violet-900/30 dark:bg-panel-dark/40">
          <Row label="Phone" value={customer.phone_e164 ?? "—"} />
          {customer.email ? (
            <Row label="Email" value={customer.email} className="mt-2" />
          ) : null}
          {customer.source ? (
            <Row
              label="Source"
              value={
                CUSTOMER_SOURCE_LABEL[customer.source] ?? customer.source
              }
              className="mt-2"
            />
          ) : null}
        </div>
      </section>

      {customer.notes?.trim() ? (
        <div className="rounded-2xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink dark:text-cream-100">
            {customer.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", className)}>
      <span className="text-xs text-ink-muted dark:text-cream-400">{label}</span>
      <span className="text-right font-medium text-ink dark:text-cream-100">
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-panel-dark/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
