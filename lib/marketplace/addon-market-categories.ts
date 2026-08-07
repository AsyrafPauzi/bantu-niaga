import type { MarketplaceAddon } from "@/lib/marketplace/types";

/** Purchasable add-on grouping (pricing-plan §8–9). Orthogonal to module pillar. */
export type AddonMarketCategory = "automation" | "scale" | "other";

export const ADDON_MARKET_CATEGORY_LABEL: Record<AddonMarketCategory, string> = {
  automation: "Automation",
  scale: "Scale",
  other: "Others",
};

const SLUG_CATEGORY: Record<string, AddonMarketCategory> = {
  // Scale — capacity & limits
  "extra-seat": "scale",
  "storage-10gb": "scale",
  "marketing-audience-export": "scale",

  // Automation — workflows & in-app feature packs
  "finance-recurring-invoices": "automation",
  "ops-booking-page": "automation",
  "customer-booking-page": "automation",
  "operations-advanced-inventory": "automation",
  "ops-advanced-inventory": "automation",
  "marketing-automation": "automation",
  "email-campaign-automation": "automation",
  "hr-staff-portal": "automation",
  "hr-shift-attendance": "automation",
  "hr-staff-appraisal": "automation",
  "hr-shift-roster": "automation",
  "hr-time-clock": "automation",
  "hr-reminder-pack": "automation",
  "boardroom-weekly": "automation",
  "admin-approval-workflow": "automation",
  "admin-compliance-alerts": "automation",
  "sales-daily-closeout": "automation",
  "sales-stale-leads": "automation",
  "auto-stock-deduction": "automation",
  "operations-auto-reorder": "automation",
  "operations-resource-scheduling": "automation",
  "dormant-reactivation": "automation",
  "product-variants": "automation",
  "operations-purchase-orders": "automation",
  "finance-cashflow-forecast": "automation",
  "finance-ledger-analytics": "automation",
  "finance-sst-reporting": "automation",
  "sales-by-staff": "automation",
  "sales-coupon-tracking": "automation",
  "sales-refund-void": "automation",
  "campaign-analytics": "automation",
  "clv-report": "automation",
  "loyalty-reviews": "automation",
  "hr-advanced-leave-policy": "automation",
  "hr-contract-letters": "automation",
  "admin-smart-vault": "automation",
  "admin-doc-builder": "automation",
  "operations-multi-location-stock": "automation",
  "operations-supplier-analytics": "automation",

  // Others — integrations, channels, usage top-ups
  "finance-bank-recon": "other",
  "finance-payment-gateway": "other",
  "whatsapp-business": "other",
  "whatsapp-business-api": "other",
  "tiktok-sync": "other",
  "sales-tiktok-sync": "other",
  "sales-shopee-sync": "other",
  "shopee-sync": "other",
  "hr-payroll-statutory": "other",
  "hr-payroll-pack": "other",
  "payroll-bank-export": "other",
  "admin-digital-signature": "other",
  "boost-credits-100": "other",
  "boost-credits-300": "other",
  "boost-credits-500": "other",
  "meta-social": "other",
  "sales-storefront": "other",
  "sales-hardware-pos": "other",
  "sales-duitnow-dynamic": "other",
  "sales-offline-pos": "other",
  "finance-billplz-checkout": "other",
};

export function addonMarketCategory(addon: MarketplaceAddon): AddonMarketCategory {
  const mapped = SLUG_CATEGORY[addon.slug];
  if (mapped) return mapped;

  const slug = addon.slug;
  if (
    slug.includes("extra-seat") ||
    slug.includes("storage") ||
    slug.includes("audience-export") ||
    slug.includes("overflow")
  ) {
    return "scale";
  }

  if (
    slug.startsWith("boost-credits") ||
    slug.includes("sync") ||
    slug.includes("whatsapp") ||
    slug.includes("shopee") ||
    slug.includes("tiktok") ||
    slug.includes("bank-recon") ||
    slug.includes("payment-gateway") ||
    slug.includes("payroll") ||
    slug.includes("billplz") ||
    slug.includes("duitnow") ||
    slug.includes("digital-signature") ||
    slug.includes("storefront") ||
    slug.includes("hardware-pos") ||
    slug.includes("offline-pos")
  ) {
    return "other";
  }

  if (
    slug.includes("automation") ||
    slug.includes("recurring") ||
    slug.includes("booking") ||
    slug.includes("auto-") ||
    slug.includes("approval") ||
    slug.includes("closeout") ||
    slug.includes("boardroom") ||
    slug.includes("staff-portal") ||
    slug.includes("shift") ||
    slug.includes("appraisal") ||
    slug.includes("inventory") ||
    slug.includes("reorder") ||
    slug.includes("reminder") ||
    slug.includes("reactivation") ||
    slug.includes("stale-lead") ||
    slug.includes("forecast") ||
    slug.includes("analytics") ||
    slug.includes("reporting") ||
    slug.includes("variants") ||
    slug.includes("purchase-order") ||
    slug.includes("scheduling") ||
    slug.includes("compliance-alert") ||
    slug.includes("smart-vault") ||
    slug.includes("doc-builder") ||
    slug.includes("contract-letter") ||
    slug.includes("leave-policy")
  ) {
    return "automation";
  }

  return "other";
}

export function isAddonMarketCategory(
  value: string,
): value is AddonMarketCategory {
  return value === "automation" || value === "scale" || value === "other";
}
