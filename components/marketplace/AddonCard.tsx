"use client";

import {
  Loader2,
  Plus,
  Settings2,
  ShoppingCart,
} from "lucide-react";
import {
  PILLAR_LABEL,
  formatMyr,
  type CatalogEntry,
} from "@/lib/marketplace/types";
import {
  addonIcon,
  isAddonActive,
  isAddonFeatureEnabled,
  isTierBundledAddon,
} from "@/lib/marketplace/active-addons";
import { isAddonFeatureDisabled } from "@/lib/marketplace/addon-meta";
import { isCreditTopupAddon } from "@/lib/marketplace/credit-topup-purchase";
import { cn } from "@/lib/utils/cn";
import { addonEligibility, tierLabel } from "./marketplace-utils";

interface AddonCardProps {
  entry: CatalogEntry;
  canEdit: boolean;
  busy: boolean;
  tier: string;
  onActivate: () => void;
  onBuyCreditTopup: () => void;
  onDeactivate: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

export function AddonCard({
  entry,
  canEdit,
  busy,
  tier,
  onActivate,
  onBuyCreditTopup,
  onDeactivate,
  onDisable,
  onEnable,
}: AddonCardProps) {
  const { addon, activation } = entry;
  const Icon = addonIcon(addon.icon);
  const isCreditTopup = isCreditTopupAddon(addon);
  const isActive = isAddonActive(entry, tier);
  const isCancelling = !!activation?.cancel_at;
  const featureDisabled = isAddonFeatureDisabled(activation);
  const featureEnabled = isAddonFeatureEnabled(entry);
  const isTierBundled = isTierBundledAddon(entry, tier);
  const isIncluded = isTierBundled || addon.included_in_tier.includes(tier);
  const isComingSoon = addon.is_coming_soon;
  const eligibility = addonEligibility(addon, tier);
  const priceLabel = isIncluded ? "Included" : formatMyr(addon.price_cents);
  const cadenceLabel = isIncluded
    ? `in your ${tierLabel(tier)} plan`
    : isCreditTopup
      ? "one-time top-up"
      : addon.cadence === "monthly"
        ? "/month"
        : addon.cadence === "yearly"
          ? "/year"
          : "one-time";

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-card transition-colors dark:bg-panel-dark ${
        isActive
          ? "border-2 border-status-success"
          : "border border-cream-300 dark:border-hairline-dark"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-xl ${
            isActive
              ? "bg-status-success/10 text-status-success"
              : "bg-brand-50 text-brand-700 dark:bg-brand-700/15 dark:text-brand-200"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        {isActive ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
              featureDisabled
                ? "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                : "bg-status-success/15 text-status-success",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                featureDisabled ? "bg-ink-subtle" : "bg-status-success",
              )}
            />
            {isCancelling ? "Cancels soon" : featureDisabled ? "Disabled" : "Active"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            {isCreditTopup ? "Top-up" : PILLAR_LABEL[addon.pillar]}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-ink dark:text-cream-100">
          {addon.name}
        </h3>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          {addon.short_desc}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between pt-2">
        <div>
          <p
            className={`text-lg font-bold ${
              isIncluded
                ? "text-status-success"
                : "text-ink dark:text-cream-100"
            }`}
          >
            {priceLabel}
          </p>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            {cadenceLabel}
          </p>
        </div>
        {isCreditTopup ? (
          <button
            onClick={onBuyCreditTopup}
            disabled={!canEdit || busy || !eligibility.canActivate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" />
            )}
            {eligibility.canActivate ? "Buy" : "Upgrade"}
          </button>
        ) : isActive ? (
          isTierBundled ? (
            <span className="rounded-lg bg-status-success/10 px-3 py-1.5 text-xs font-semibold text-status-success">
              Included in plan
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {featureEnabled ? (
                <button
                  onClick={onDisable}
                  disabled={!canEdit || busy}
                  className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  Disable
                </button>
              ) : (
                <button
                  onClick={onEnable}
                  disabled={!canEdit || busy}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enable
                </button>
              )}
              {!isCancelling ? (
                <button
                  onClick={onDeactivate}
                  disabled={!canEdit || busy}
                  className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          )
        ) : isComingSoon ? (
          <span className="rounded-lg bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:bg-panel-dark dark:text-cream-400">
            Coming soon
          </span>
        ) : isIncluded ? (
          <button
            onClick={onActivate}
            disabled={!canEdit || busy || !eligibility.canActivate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </button>
        ) : (
          <button
            onClick={onActivate}
            disabled={!canEdit || busy || !eligibility.canActivate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {eligibility.canActivate ? "Activate" : "Upgrade"}
          </button>
        )}
      </div>
      {!isCreditTopup && !isActive && !eligibility.canActivate ? (
        <p className="rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-ink-muted dark:text-cream-400">
          {eligibility.reason}
        </p>
      ) : null}
    </article>
  );
}
