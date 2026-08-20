import Link from "next/link";
import { Gift, Ticket } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import { CouponStatusBadge } from "@/components/marketing/CouponStatusBadge";
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

export function CouponDetailView({ coupon, redemptions }: CouponDetailViewProps) {
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
    <div className="space-y-6 pb-8">
      <ModuleDashboardHero
        module="Marketing · Coupons"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        headerExtra={
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={statusToneOf(coupon.status)}>
              {coupon.status}
            </StatusPill>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
              <Ticket className="h-3 w-3" strokeWidth={2} />
              {coupon.type === "PCT" ? "Percentage" : "Fixed amount"}
            </span>
          </div>
        }
        cta={
          <CouponShareLink code={coupon.code} discountLabel={discountLabel} />
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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
      </ModuleDashboardHero>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-cream-200 bg-panel-light px-5 py-4 text-sm shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Valid window
          </p>
          <p className="font-medium text-ink dark:text-cream-100">
            {formatValidWindow(coupon.valid_from, coupon.valid_until)}
          </p>
        </div>
        {coupon.min_subtotal_myr > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Min subtotal
            </p>
            <p className="font-medium text-ink dark:text-cream-100">
              {formatMyr(coupon.min_subtotal_myr)}
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Status
          </p>
          <CouponStatusBadge status={coupon.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-cream-200 bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Edit coupon
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Code is immutable. Edit value, dates, limits, status, or scope
              below.
            </p>
          </div>
          <div className="p-5">
            <CouponDetailEditor coupon={coupon} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cream-200 bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Redemption log
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              {coupon.redeemed_count.toLocaleString()} total redemption
              {coupon.redeemed_count === 1 ? "" : "s"}
              {coupon.total_limit != null
                ? ` of ${coupon.total_limit.toLocaleString()}`
                : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                <tr>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-3 py-3 text-right">Discount</th>
                  <th className="px-5 py-3 text-right">When</th>
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
                    <tr
                      key={r.id}
                      className="bg-panel-light dark:bg-panel-dark"
                    >
                      <td className="px-5 py-3">
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
                            Order ref:{" "}
                            <code className="font-mono">{r.order_ref}</code>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                        {formatMyr(r.discount_amount_myr)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                        {relativeTime(r.redeemed_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
