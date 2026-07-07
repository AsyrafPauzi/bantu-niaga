import type { TierKey } from "@/lib/settings/plans";
import type { BusinessType, PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";

/** 15% off add-on portion when buying as a business bundle (Phase 1: display only). */
export const BUNDLE_ADDON_DISCOUNT_RATE = 0.15;

export interface BundleAddonRef {
  slug: string;
  /** Shown when slug is not yet in marketplace catalog. */
  plannedLabel?: string;
  /** Opt-in only — e.g. payroll when salaried staff exist. */
  optional?: boolean;
  optionalHint?: string;
}

export interface BusinessBundle {
  id: string;
  name: string;
  tagline: string;
  forBusinessTypes: readonly BusinessType[];
  recommendedTier: TierKey;
  addons: readonly BundleAddonRef[];
}

export const BUSINESS_BUNDLES: readonly BusinessBundle[] = [
  {
    id: "pakej-kedai",
    name: "Pakej Kedai",
    tagline: "Kedai runcit with staff and DuitNow at the counter",
    forBusinessTypes: ["retail"],
    recommendedTier: "sme",
    addons: [
      { slug: "hr-assistant" },
      { slug: "dynamic-duitnow-qr", plannedLabel: "Dynamic DuitNow QR" },
    ],
  },
  {
    id: "pakej-kafe",
    name: "Pakej Kafe",
    tagline: "F&B counter staff, HR, and daily close-out",
    forBusinessTypes: ["fnb"],
    recommendedTier: "sme",
    addons: [
      { slug: "hr-assistant" },
      { slug: "daily-close-out", plannedLabel: "Daily close-out reconciliation" },
      {
        slug: "hr-payroll-pack",
        optional: true,
        optionalHint: "Only when you have salaried staff",
        plannedLabel: "Payroll & statutory pack",
      },
    ],
  },
  {
    id: "pakej-online",
    name: "Pakej Online",
    tagline: "Shopee seller + marketing AI",
    forBusinessTypes: ["online"],
    recommendedTier: "enterprise",
    addons: [
      { slug: "shopee-sync" },
      { slug: "marketing-assistant" },
    ],
  },
  {
    id: "pakej-servis",
    name: "Pakej Servis",
    tagline: "Salon, homestay, and appointment businesses",
    forBusinessTypes: ["services"],
    recommendedTier: "micro",
    addons: [
      { slug: "hr-assistant" },
      {
        slug: "customer-booking-page",
        plannedLabel: "Customer booking page",
      },
    ],
  },
  {
    id: "pakej-team",
    name: "Pakej Team Kecil",
    tagline: "Small team needing leave and HR help",
    forBusinessTypes: ["other", "freelancer"],
    recommendedTier: "sme",
    addons: [{ slug: "hr-assistant" }, { slug: "hr-public-holidays" }],
  },
] as const;

export function bundleForBusinessType(
  businessType: BusinessType,
): BusinessBundle | null {
  return (
    BUSINESS_BUNDLES.find((b) => b.forBusinessTypes.includes(businessType)) ??
    BUSINESS_BUNDLES.find((b) => b.id === "pakej-team") ??
    null
  );
}

export function bundleForQuizAnswers(
  answers: PlanQuizAnswers | null,
): BusinessBundle | null {
  if (!answers) return null;
  const byType = bundleForBusinessType(answers.businessType);
  if (byType) return byType;

  if (answers.priorities.includes("marketing") || answers.businessType === "online") {
    return BUSINESS_BUNDLES.find((b) => b.id === "pakej-online") ?? null;
  }
  if (answers.priorities.includes("leave") || answers.teamSize !== "solo") {
    return BUSINESS_BUNDLES.find((b) => b.id === "pakej-kafe") ?? byType;
  }
  return BUSINESS_BUNDLES.find((b) => b.id === "pakej-team") ?? null;
}

export interface BundlePricingLine {
  slug: string;
  name: string;
  priceCents: number;
  monthly: boolean;
  comingSoon: boolean;
  optional: boolean;
  active: boolean;
  includedInTier: boolean;
}

export interface BundlePricingSummary {
  bundleId: string;
  bundleName: string;
  recommendedTier: TierKey;
  planPriceCents: number;
  lines: BundlePricingLine[];
  addonSubtotalCents: number;
  bundleAddonSubtotalCents: number;
  savingsCents: number;
  totalAlaCarteCents: number;
  totalBundleCents: number;
}

export function computeBundlePricing(opts: {
  bundle: BusinessBundle;
  planPriceCents: number;
  catalogBySlug: Map<
    string,
    {
      name: string;
      price_cents: number;
      cadence: string;
      included_in_tier: string[];
      is_coming_soon: boolean;
    }
  >;
  currentTier: TierKey;
  activeSlugs: Set<string>;
  selectedOptionalSlugs: Set<string>;
}): BundlePricingSummary {
  const lines: BundlePricingLine[] = [];

  for (const ref of opts.bundle.addons) {
    const cat = opts.catalogBySlug.get(ref.slug);
    const comingSoon = !cat || cat.is_coming_soon;
    const optional = ref.optional === true;
    if (optional && !opts.selectedOptionalSlugs.has(ref.slug)) {
      continue;
    }

    const includedInTier = cat
      ? cat.included_in_tier.includes(opts.currentTier)
      : false;

    lines.push({
      slug: ref.slug,
      name: cat?.name ?? ref.plannedLabel ?? ref.slug,
      priceCents: cat?.price_cents ?? 0,
      monthly: cat ? cat.cadence === "monthly" || cat.cadence === "yearly" : true,
      comingSoon,
      optional,
      active: opts.activeSlugs.has(ref.slug),
      includedInTier,
    });
  }

  const addonSubtotalCents = lines.reduce((sum, line) => {
    if (line.comingSoon || line.active || line.includedInTier) return sum;
    return sum + line.priceCents;
  }, 0);

  const bundleAddonSubtotalCents = Math.round(
    addonSubtotalCents * (1 - BUNDLE_ADDON_DISCOUNT_RATE),
  );
  const savingsCents = addonSubtotalCents - bundleAddonSubtotalCents;
  const totalAlaCarteCents = opts.planPriceCents + addonSubtotalCents;
  const totalBundleCents = opts.planPriceCents + bundleAddonSubtotalCents;

  return {
    bundleId: opts.bundle.id,
    bundleName: opts.bundle.name,
    recommendedTier: opts.bundle.recommendedTier,
    planPriceCents: opts.planPriceCents,
    lines,
    addonSubtotalCents,
    bundleAddonSubtotalCents,
    savingsCents,
    totalAlaCarteCents,
    totalBundleCents,
  };
}
