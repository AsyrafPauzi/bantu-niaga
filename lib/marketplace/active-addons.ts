import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Calendar,
  Database,
  FileCheck,
  MessageCircle,
  Music,
  Settings2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { CatalogEntry } from "./types";

export const ADDON_ICON_MAP: Record<string, LucideIcon> = {
  calendar: Calendar,
  "clipboard-list": ClipboardList,
  "message-circle": MessageCircle,
  "user-plus": UserPlus,
  users: Users,
  database: Database,
  zap: Zap,
  music: Music,
  "file-check": FileCheck,
  sparkles: Sparkles,
  "shopping-bag": ShoppingBag,
  "trending-up": TrendingUp,
};

export function addonIcon(iconKey: string): LucideIcon {
  return ADDON_ICON_MAP[iconKey] ?? Settings2;
}

export function isAddonActive(entry: CatalogEntry, tier: string): boolean {
  const { addon, activation } = entry;
  if (
    activation &&
    (activation.status === "active" || activation.status === "pending_cancel")
  ) {
    return true;
  }
  if (
    addon.cadence === "included" &&
    addon.included_in_tier.includes(tier)
  ) {
    return true;
  }
  return false;
}

export function isPurchasedActivation(entry: CatalogEntry): boolean {
  const { activation } = entry;
  return Boolean(
    activation &&
      (activation.status === "active" ||
        activation.status === "pending_cancel"),
  );
}

export function formatAddonDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function addonStatusLine(
  entry: CatalogEntry,
  tier: string,
  tierLabel: string,
): string {
  const { addon, activation } = entry;

  if (activation?.cancel_at) {
    return `Cancels on ${formatAddonDate(activation.cancel_at)}`;
  }

  if (activation?.next_charge_at && activation.activated_at) {
    return `Active since ${formatAddonDate(activation.activated_at)} · renews ${formatAddonDate(activation.next_charge_at)}`;
  }

  if (activation?.activated_at) {
    return `Active since ${formatAddonDate(activation.activated_at)}`;
  }

  if (
    addon.cadence === "included" &&
    addon.included_in_tier.includes(tier)
  ) {
    return `Included in your ${tierLabel} plan`;
  }

  if (addon.cadence === "one_time") {
    return "One-time purchase · no renewal";
  }

  return "Active";
}

export function resolveNextChargeDate(
  subscriptionRenewalAt: string | null,
  activeEntries: CatalogEntry[],
): string | null {
  if (subscriptionRenewalAt) {
    return subscriptionRenewalAt;
  }

  const addonDates = activeEntries
    .map((e) => e.activation?.next_charge_at)
    .filter((d): d is string => Boolean(d))
    .sort();

  return addonDates[0] ?? null;
}

export function sortActiveEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = a.activation?.activated_at
      ? new Date(a.activation.activated_at).getTime()
      : 0;
    const bTime = b.activation?.activated_at
      ? new Date(b.activation.activated_at).getTime()
      : 0;
    return bTime - aTime;
  });
}
