import { redirect } from "next/navigation";
import { OnboardingRecommendationView } from "@/components/onboarding/OnboardingRecommendationView";
import type { CatalogAddonSnapshot } from "@/components/onboarding/OnboardingRecommendationView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import type { PlanQuizAnswers, PriorityNeed } from "@/lib/onboarding/plan-quiz";
import { loadCatalog } from "@/lib/marketplace/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/settings/plans";

export const metadata = { title: "Your recommendation" };
export const dynamic = "force-dynamic";

function quizFromBusinessRow(row: {
  business_type: string | null;
  team_size_band: string | null;
  onboarding_priorities: unknown;
}): PlanQuizAnswers | null {
  if (!row.business_type || !row.team_size_band) return null;
  const priorities = Array.isArray(row.onboarding_priorities)
    ? (row.onboarding_priorities as PriorityNeed[])
    : [];
  return {
    businessType: row.business_type as PlanQuizAnswers["businessType"],
    teamSize: row.team_size_band as PlanQuizAnswers["teamSize"],
    priorities,
  };
}

export default async function OnboardingRecommendationPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (user.role !== "owner") {
    redirect("/home");
  }

  const supabase = await createSupabaseServerClient();
  const [businessRes, catalog] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "name, tier, onboarding_completed_at, business_type, team_size_band, onboarding_priorities",
      )
      .eq("id", user.businessId)
      .maybeSingle(),
    loadCatalog(),
  ]);

  const business = businessRes.data;
  if (!business) redirect("/home");

  if (business.onboarding_completed_at) {
    redirect("/home");
  }

  const catalogSnapshot: CatalogAddonSnapshot[] = catalog.map((entry) => ({
    slug: entry.addon.slug,
    name: entry.addon.name,
    short_desc: entry.addon.short_desc,
    price_cents: entry.addon.price_cents,
    cadence: entry.addon.cadence,
    included_in_tier: entry.addon.included_in_tier,
    is_coming_soon: entry.addon.is_coming_soon,
  }));

  const activeAddonSlugs = catalog
    .filter(
      (entry) =>
        entry.activation?.status === "active" ||
        entry.activation?.status === "pending_cancel",
    )
    .map((entry) => entry.addon.slug);

  return (
    <div className="min-h-dvh bg-cream-100 px-4 py-10 dark:bg-canvas-dark">
      <OnboardingRecommendationView
        businessName={business.name}
        currentTier={business.tier as TierKey}
        quizFromDb={quizFromBusinessRow(business)}
        catalog={catalogSnapshot}
        activeAddonSlugs={activeAddonSlugs}
      />
    </div>
  );
}
