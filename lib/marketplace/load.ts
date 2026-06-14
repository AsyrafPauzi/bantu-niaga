import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BusinessAddon,
  CatalogEntry,
  MarketplaceAddon,
} from "./types";

/**
 * Returns the full catalog joined with each row's activation state for
 * the current business. Read-only; safe to call from server components.
 *
 * Wrapped in `react.cache()` — multiple Server Components that read the
 * catalog within a single request share one Supabase round-trip.
 */
export const loadCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const supabase = await createSupabaseServerClient();

  const [{ data: addonsData, error: addonsError }, { data: bizData, error: bizError }] =
    await Promise.all([
      supabase
        .from("marketplace_addons")
        .select(
          "id, slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, included_in_tier, is_featured, sort_order",
        )
        .order("sort_order", { ascending: true }),
      supabase
        .from("business_addons")
        .select(
          "id, business_id, addon_id, status, activated_at, next_charge_at, cancel_at, qty, meta",
        )
        .neq("status", "cancelled"),
    ]);

  if (addonsError) throw addonsError;
  if (bizError) throw bizError;

  const addons = (addonsData ?? []) as MarketplaceAddon[];
  const activations = (bizData ?? []) as BusinessAddon[];
  const byAddonId = new Map<string, BusinessAddon>();
  for (const a of activations) byAddonId.set(a.addon_id, a);

  return addons.map((addon) => ({
    addon,
    activation: byAddonId.get(addon.id) ?? null,
  }));
});
