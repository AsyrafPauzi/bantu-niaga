import Link from "next/link";
import { Package, Sparkles } from "lucide-react";
import {
  BUNDLE_ADDON_DISCOUNT_RATE,
  type BundlePricingLine,
} from "@/lib/onboarding/business-bundles";
import type { MarketplaceBundleCard } from "@/lib/marketplace/bundle-display";
import { formatMyr } from "@/lib/marketplace/types";
import { cn } from "@/lib/utils/cn";

export function BundleCard({
  card,
  canEdit,
  tier,
}: {
  card: MarketplaceBundleCard;
  canEdit: boolean;
  tier: string;
}) {
  const { bundle, pricing, recommendedTierLabel, tierMeetsRecommendation } =
    card;
  const onFree = tier === "starter";
  const purchasableLines = pricing.lines.filter(
    (line) => !line.comingSoon && !line.active && !line.includedInTier,
  );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-cream-300 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-700/15 dark:text-brand-200">
          <Package className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
          {recommendedTierLabel} plan
        </span>
      </div>

      <div>
        <h3 className="text-base font-semibold text-ink dark:text-cream-100">
          {bundle.name}
        </h3>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          {bundle.tagline}
        </p>
      </div>

      <ul className="space-y-2 text-sm text-ink-muted dark:text-cream-400">
        {pricing.lines.map((line) => (
          <BundleLineItem key={line.slug} line={line} />
        ))}
      </ul>

      <div className="mt-auto rounded-xl bg-cream-100/80 p-4 dark:bg-hairline-dark/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Bundle estimate / month
        </p>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <p className="text-2xl font-bold text-ink dark:text-cream-100">
            {formatMyr(pricing.totalBundleCents)}
          </p>
          {pricing.totalAlaCarteCents > pricing.totalBundleCents ? (
            <p className="text-sm text-ink-muted line-through dark:text-cream-500">
              {formatMyr(pricing.totalAlaCarteCents)}
            </p>
          ) : null}
        </div>
        {pricing.savingsCents > 0 ? (
          <p className="mt-1 text-xs font-medium text-status-success">
            Save {formatMyr(pricing.savingsCents)} on add-ons (
            {Math.round(BUNDLE_ADDON_DISCOUNT_RATE * 100)}% bundle discount)
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-ink-subtle dark:text-cream-500">
          Includes {recommendedTierLabel} plan + listed modules. Discount applies
          to add-ons when activated together as a pack.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {!tierMeetsRecommendation || onFree ? (
          <Link
            href="/settings/subscription"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold",
              canEdit
                ? "bg-brand-500 text-white hover:bg-brand-600"
                : "pointer-events-none cursor-not-allowed bg-cream-200 text-ink-muted dark:bg-panel-dark",
            )}
            aria-disabled={!canEdit}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {onFree
              ? "Upgrade plan to unlock bundle"
              : `Upgrade to ${recommendedTierLabel}`}
          </Link>
        ) : purchasableLines.length > 0 ? (
          <p className="rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-ink-muted dark:text-cream-400">
            Activate each module below, or use one-click pack activation when it
            ships.
          </p>
        ) : (
          <p className="rounded-lg bg-status-success/10 px-3 py-2 text-xs font-medium text-status-success">
            All modules in this bundle are active or included in your plan.
          </p>
        )}
      </div>
    </article>
  );
}

function BundleLineItem({ line }: { line: BundlePricingLine }) {
  const status = line.active
    ? "Active"
    : line.includedInTier
      ? "Included in plan"
      : line.comingSoon
        ? "Coming soon"
        : line.optional
          ? "Optional"
          : formatMyr(line.priceCents);

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-ink dark:text-cream-100">{line.name}</span>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          line.active || line.includedInTier
            ? "text-status-success"
            : line.comingSoon
              ? "text-ink-subtle"
              : "text-ink-muted dark:text-cream-400",
        )}
      >
        {status}
      </span>
    </li>
  );
}
