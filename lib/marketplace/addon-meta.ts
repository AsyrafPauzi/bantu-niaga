import type { BusinessAddon } from "@/lib/marketplace/types";

/** Feature off in-app; subscription billing continues until cancel. */
export function isAddonFeatureDisabled(
  activation: BusinessAddon | null | undefined,
): boolean {
  if (!activation?.meta) return false;
  return activation.meta.feature_disabled === true;
}

/** Subscribed row still on the bill (active or pending end-of-term cancel). */
export function isAddonBillingActive(
  activation: BusinessAddon | null | undefined,
): boolean {
  if (!activation) return false;
  return (
    activation.status === "active" || activation.status === "pending_cancel"
  );
}

/** Feature gates: billed, not disabled, not past cancel window. */
export function isAddonFeatureAccessible(
  activation: BusinessAddon | null | undefined,
): boolean {
  if (!isAddonBillingActive(activation)) return false;
  if (isAddonFeatureDisabled(activation)) return false;
  if (
    activation?.status === "pending_cancel" &&
    activation.cancel_at &&
    new Date(activation.cancel_at).getTime() <= Date.now()
  ) {
    return false;
  }
  return true;
}
