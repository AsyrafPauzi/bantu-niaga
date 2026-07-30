import { redirect } from "next/navigation";
import { OnboardingRecommendationView } from "@/components/onboarding/OnboardingRecommendationView";
import type { CatalogAddonSnapshot } from "@/components/onboarding/OnboardingRecommendationView";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  dbRowToPlanQuiz,
  isOnboardingQuizPersisted,
  planQuizToDbPayload,
  resolveOnboardingQuizAnswers,
} from "@/lib/onboarding/default-quiz";
import { loadCatalog } from "@/lib/marketplace/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TierKey } from "@/lib/settings/plans";

export const metadata = { title: "Your recommendation" };
export const dynamic = "force-dynamic";

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

  if (!isOnboardingQuizPersisted(business)) {
    const quizDb = planQuizToDbPayload(resolveOnboardingQuizAnswers(null));
    await supabase
      .from("businesses")
      .update({
        business_type: quizDb.business_type,
        team_size_band: quizDb.team_size_band,
        onboarding_priorities: quizDb.priorities,
      })
      .eq("id", user.businessId);
    business.business_type = quizDb.business_type;
    business.team_size_band = quizDb.team_size_band;
    business.onboarding_priorities = quizDb.priorities;
  }

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

  const quiz = resolveOnboardingQuizAnswers(dbRowToPlanQuiz(business));

  return (
    <div className="min-h-dvh bg-cream-100 px-4 py-10 dark:bg-canvas-dark">
      <OnboardingRecommendationView
        businessName={business.name}
        currentTier={business.tier as TierKey}
        quiz={quiz}
        catalog={catalogSnapshot}
        activeAddonSlugs={activeAddonSlugs}
      />
    </div>
  );
}
