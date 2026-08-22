import Link from "next/link";
import { CalendarRange, Gift, Ticket } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import { formatMyr } from "@/lib/marketing/metrics";
import { couponDetailSubpageHero } from "@/lib/marketing/subpage-hero";
import { CouponDetailEditor } from "@/app/(app)/marketing/coupons/[id]/detail-editor";
import { CouponShareLink } from "@/app/(app)/marketing/coupons/[id]/share-link";

export interface CouponDetailData {
  id: string;
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number;
  min_subtotal_myr: number;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  segment_id: string | null;
  status: "active" | "paused" | "expired";
  redeemed_count: number;
}

export interface CouponRedemptionRow {
  id: string;
  customer_id: string | null;
  order_ref: string | null;
  discount_amount_myr: number;
  redeemed_at: string;
  customer_name?: string;
}

function statusToneOf(
  status: CouponDetailData["status"],
): "success" | "warning" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "expired":
      return "neutral";
  }
}

function formatValidWindow(from: string, until: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  const f = new Date(from).toLocaleDateString("en-MY", opts);
  if (!until) return `From ${f}`;
  const u = new Date(until).toLocaleDateString("en-MY", opts);
  return `${f} → ${u}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

interface CouponDetailViewProps {
  coupon: CouponDetailData;
  redemptions: CouponRedemptionRow[];
}

export function CouponDetailView({
  coupon,
  redemptions,
}: CouponDetailViewProps) {
  const hero = couponDetailSubpageHero({
    code: coupon.code,
    name: coupon.name,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.min_subtotal_myr,
    status: coupon.status,
    redeemedCount: coupon.redeemed_count,
    totalLimit: coupon.total_limit,
  });

  const discountLabel =
    coupon.type === "PCT"
      ? `${coupon.value}% off`
      : `${formatMyr(coupon.value)} off`;
  const remaining =
    coupon.total_limit != null
      ? Math.max(0, coupon.total_limit - coupon.redeemed_count)
      : null;

  return (
    <div className="space-y-4">
      <ModuleDashboardHero
        module="Marketing · Coupons"
        pillar="marketing"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant="calm"
        headerExtra={
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={statusToneOf(coupon.status)}>
              {coupon.status}
            </StatusPill>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400">
              <Ticket className="h-3 w-3" strokeWidth={2} />
              {coupon.type === "PCT" ? "Percentage" : "Fixed amount"}
            </span>
          </div>
        }
      >
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Discount"
            value={discountLabel}
            icon={<Gift />}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Redeemed"
            value={coupon.redeemed_count}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Remaining"
            value={remaining ?? "∞"}
            hint={coupon.total_limit != null ? "of limit" : "no cap"}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Per customer"
            value={coupon.per_customer_limit}
            hint="max uses"
            iconClassName="text-amber-700 dark:text-amber-300"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-purple-200/40 pt-4 dark:border-purple-900/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted dark:text-cream-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink dark:text-cream-100">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {formatValidWindow(coupon.valid_from, coupon.valid_until)}
            </span>
            {coupon.min_subtotal_myr > 0 ? (
              <span>Min order {formatMyr(coupon.min_subtotal_myr)}</span>
            ) : (
              <span>No min order</span>
            )}
          </div>
          <CouponShareLink code={coupon.code} discountLabel={discountLabel} />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
        <section className="overflow-hidden rounded-xl border border-cream-200 bg-panel-light shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
          <header className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Edit coupon
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Code is locked. Update value, dates, limits, or status below.
            </p>
          </header>
          <div className="p-4 sm:p-5">
            <CouponDetailEditor coupon={coupon} />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-cream-200 bg-panel-light shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
          <header className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Redemption log
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              {coupon.redeemed_count.toLocaleString()} total
              {coupon.total_limit != null
                ? ` · ${coupon.total_limit.toLocaleString()} cap`
                : " · unlimited"}
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-50 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/20 dark:text-cream-400">
                <tr>
                  <th className="px-4 py-2.5 text-left sm:px-5">Customer</th>
                  <th className="px-3 py-2.5 text-right">Discount</th>
                  <th className="px-4 py-2.5 text-right sm:px-5">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {redemptions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                    >
                      No redemptions yet — share the link or redeem at Sales
                      POS.
                    </td>
                  </tr>
                ) : (
                  redemptions.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 sm:px-5">
                        {r.customer_id ? (
                          <Link
                            href={`/marketing/customers/${r.customer_id}`}
                            className="text-sm font-semibold text-ink hover:text-brand-700 dark:text-cream-100"
                          >
                            {r.customer_name ?? "Unknown customer"}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-muted dark:text-cream-400">
                            Walk-in
                          </span>
                        )}
                        {r.order_ref ? (
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            Order{" "}
                            <code className="font-mono">{r.order_ref}</code>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                        {formatMyr(r.discount_amount_myr)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-muted dark:text-cream-400 sm:px-5">
                        {relativeTime(r.redeemed_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
