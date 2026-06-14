/**
 * Server-side guard: refuse access to pillar pages that the current
 * business's tier doesn't unlock.
 *
 * Usage (inside a server component / pillar `layout.tsx`):
 *
 *   import { requirePillar } from "@/lib/auth/require-pillar";
 *   await requirePillar("operations");
 *
 * Behaviour:
 *   - No session             → redirects to `/sign-in`.
 *   - No business / no row   → redirects to `/sign-in` (treats as unauth).
 *   - Tier does not include  → redirects to
 *                              `/settings/subscription?locked=<pillar>`
 *                              so the owner sees why and can upgrade.
 *   - Tier includes pillar   → returns the current user + business tier
 *                              for the caller to use if needed.
 */
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPillar, type Pillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";

export interface PillarGuardResult {
  user: CurrentUser;
  tier: TierKey;
}

export async function requirePillar(pillar: Pillar): Promise<PillarGuardResult> {
  let user: CurrentUser;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect("/sign-in");
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", user.businessId)
    .maybeSingle();

  if (error || !data) {
    redirect("/sign-in");
  }

  const tier = data.tier as TierKey;
  if (!hasPillar(tier, pillar)) {
    redirect(`/settings/subscription?locked=${pillar}`);
  }

  return { user, tier };
}
