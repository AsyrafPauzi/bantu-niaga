/**
 * Marketplace add-ons with shipped product behavior (CHECKLIST + code gates).
 * Everything else stays catalog-only with `is_coming_soon = true`.
 */
import { CREDIT_TOPUP_ADDON_SLUGS } from "@/lib/marketplace/credit-topup-purchase";
import {
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
} from "@/lib/marketplace/agent-addon-slugs";

export const SHIPPED_MARKETPLACE_ADDON_SLUGS: readonly string[] = [
  ADMIN_ASSISTANT_ADDON_SLUG,
  FINANCE_ASSISTANT_ADDON_SLUG,
  MARKETING_ASSISTANT_ADDON_SLUG,
  SALES_ASSISTANT_ADDON_SLUG,
  OPERATIONS_ASSISTANT_ADDON_SLUG,
  HR_ASSISTANT_ADDON_SLUG,
  "hr-public-holidays",
  "hr-staff-appraisal",
  "hr-staff-portal",
  "hr-shift-attendance",
  "hr-reminder-pack",
  "storage-10gb",
  "boardroom-weekly",
  ...CREDIT_TOPUP_ADDON_SLUGS,
];

export function isShippedMarketplaceAddon(slug: string): boolean {
  return SHIPPED_MARKETPLACE_ADDON_SLUGS.includes(slug);
}
