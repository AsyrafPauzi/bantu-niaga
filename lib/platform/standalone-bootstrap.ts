import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isStandaloneDeployment } from "@/lib/platform/deployment";

/**
 * Standalone installs allow one-time public sign-up only while no business
 * exists yet (first owner bootstrap). After that, use `npm run seed` or
 * invite flows.
 */
export async function isStandaloneBootstrapOpen(
  admin: SupabaseClient,
): Promise<boolean> {
  if (!isStandaloneDeployment()) return false;

  const { count, error } = await admin
    .from("businesses")
    .select("id", { count: "exact", head: true });

  if (error) return false;
  return (count ?? 0) === 0;
}

export async function canAcceptPublicSignup(
  admin: SupabaseClient,
): Promise<boolean> {
  if (!isStandaloneDeployment()) return true;
  return isStandaloneBootstrapOpen(admin);
}

/**
 * Optional pin for standalone data imports / scripts — when set, tooling can
 * target a specific tenant without scanning.
 */
export function getStandaloneBusinessId(): string | null {
  const raw = process.env.STANDALONE_BUSINESS_ID?.trim();
  return raw && raw.length > 0 ? raw : null;
}
