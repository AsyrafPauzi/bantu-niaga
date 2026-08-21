"use client";

import { CheckCircle2, Loader2, Plus, Star } from "lucide-react";
import {
  CADENCE_LABEL,
  formatMyr,
  type CatalogEntry,
} from "@/lib/marketplace/types";
import {
  addonIcon,
  isAddonActive,
  isTierBundledAddon,
} from "@/lib/marketplace/active-addons";
import { addonEligibility } from "./marketplace-utils";

interface FeaturedBannerProps {
  entry: CatalogEntry;
  busy: boolean;
  canEdit: boolean;
  tier: string;
  onActivate: () => void;
  onDeactivate: () => void;
}

export function FeaturedBanner({
  entry,
  busy,
  canEdit,
  tier,
  onActivate,
  onDeactivate,
}: FeaturedBannerProps) {
  const Icon = addonIcon(entry.addon.icon);
  const isActive = isAddonActive(entry, tier);
  const isTierBundled = isTierBundledAddon(entry, tier);
  const isComingSoon = entry.addon.is_coming_soon;
  const eligibility = addonEligibility(entry.addon, tier);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-6 text-white shadow-card sm:px-8 sm:py-8">
      <div className="relative grid items-center gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
            Featured
          </span>
          <h2 className="max-w-xl text-2xl font-bold leading-tight sm:text-[26px]">
            {entry.addon.name}
          </h2>
          <p className="max-w-lg text-sm text-brand-100">
            {entry.addon.short_desc}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isActive ? (
              isTierBundled ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4" />
                  Included in plan
                </span>
              ) : (
                <button
                  onClick={onDeactivate}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Active · Manage
                </button>
              )
            ) : isComingSoon ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white">
                Coming soon
              </span>
            ) : (
              <button
                onClick={onActivate}
                disabled={!canEdit || busy || !eligibility.canActivate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-accent-600 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {eligibility.canActivate
                  ? `Activate · ${formatMyr(entry.addon.price_cents)}${CADENCE_LABEL[entry.addon.cadence]}`
                  : "Upgrade required"}
              </button>
            )}
            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-brand-100 hover:text-white"
            >
              Read setup guide →
            </a>
          </div>
          {!isActive && !isComingSoon && !eligibility.canActivate ? (
            <p className="text-xs text-brand-100">{eligibility.reason}</p>
          ) : isComingSoon && !isActive ? (
            <p className="text-xs text-brand-100">
              Catalog placeholder — activation opens when this module ships.
            </p>
          ) : null}
        </div>
        <div className="hidden flex-col items-end gap-3 sm:flex">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-white/10 backdrop-blur">
            <Icon className="h-12 w-12 text-white" strokeWidth={1.5} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <Star className="h-3 w-3" />
            {isComingSoon ? "Coming soon" : "Most installed"}
          </span>
        </div>
      </div>
    </section>
  );
}
