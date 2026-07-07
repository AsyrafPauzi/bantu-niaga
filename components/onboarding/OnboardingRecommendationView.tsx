"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client-error";
import {
  BUNDLE_ADDON_DISCOUNT_RATE,
  bundleForQuizAnswers,
  computeBundlePricing,
  type BusinessBundle,
} from "@/lib/onboarding/business-bundles";
import type { PlanQuizAnswers } from "@/lib/onboarding/plan-quiz";
import { recommendPlanFromQuiz } from "@/lib/onboarding/plan-quiz";
import {
  clearQuizSession,
  readQuizFromSession,
} from "@/lib/onboarding/session-quiz";
import { formatMyr } from "@/lib/marketplace/types";
import { tierBy, type TierKey } from "@/lib/settings/plans";
import { cn } from "@/lib/utils/cn";

export interface CatalogAddonSnapshot {
  slug: string;
  name: string;
  short_desc: string;
  price_cents: number;
  cadence: string;
  included_in_tier: string[];
  is_coming_soon: boolean;
}

export interface OnboardingRecommendationProps {
  businessName: string;
  currentTier: TierKey;
  quizFromDb: PlanQuizAnswers | null;
  catalog: CatalogAddonSnapshot[];
  activeAddonSlugs: string[];
}

const TIER_ORDER: TierKey[] = ["starter", "micro", "sme", "enterprise"];

function tierRank(tier: TierKey): number {
  return TIER_ORDER.indexOf(tier);
}

export function OnboardingRecommendationView({
  businessName,
  currentTier,
  quizFromDb,
  catalog,
  activeAddonSlugs,
}: OnboardingRecommendationProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"plan" | "addons" | "done">("plan");
  const [planActivated, setPlanActivated] = useState(false);
  const [activatedSlugs, setActivatedSlugs] = useState<Set<string>>(
    () => new Set(activeAddonSlugs),
  );
  const [optionalSelected, setOptionalSelected] = useState<Set<string>>(
    () => new Set(),
  );

  const quiz = useMemo(() => {
    if (quizFromDb) return quizFromDb;
    return readQuizFromSession();
  }, [quizFromDb]);

  const planResult = useMemo(
    () => (quiz ? recommendPlanFromQuiz(quiz) : null),
    [quiz],
  );

  const bundle: BusinessBundle | null = useMemo(
    () => bundleForQuizAnswers(quiz),
    [quiz],
  );

  const catalogBySlug = useMemo(
    () => new Map(catalog.map((row) => [row.slug, row])),
    [catalog],
  );

  const recommendedTier = bundle?.recommendedTier ?? planResult?.recommendedTier ?? currentTier;
  const recommendedTierMeta = tierBy(recommendedTier);
  const planPriceCents = (recommendedTierMeta?.priceMyr ?? 0) * 100;
  const needsPlanUpgrade = tierRank(recommendedTier) > tierRank(currentTier);

  const pricing = useMemo(() => {
    if (!bundle) return null;
    return computeBundlePricing({
      bundle,
      planPriceCents,
      catalogBySlug,
      currentTier: planActivated ? recommendedTier : currentTier,
      activeSlugs: activatedSlugs,
      selectedOptionalSlugs: optionalSelected,
    });
  }, [
    bundle,
    planPriceCents,
    catalogBySlug,
    currentTier,
    recommendedTier,
    planActivated,
    activatedSlugs,
    optionalSelected,
  ]);

  const persistQuiz = useCallback(async (answers: PlanQuizAnswers) => {
    await fetch("/api/onboarding/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_type: answers.businessType,
        team_size_band: answers.teamSize,
        priorities: answers.priorities,
      }),
    });
  }, []);

  useEffect(() => {
    const sessionQuiz = readQuizFromSession();
    if (sessionQuiz && !quizFromDb) {
      void persistQuiz(sessionQuiz);
    }
  }, [quizFromDb, persistQuiz]);

  async function finishOnboarding(destination: string) {
    setError(null);
    const res = await fetch("/api/onboarding/complete", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(apiErrorMessage(json, "Could not save your choice"));
      return;
    }
    clearQuizSession();
    startTransition(() => {
      router.replace(destination);
      router.refresh();
    });
  }

  async function activatePlan() {
    if (!needsPlanUpgrade) {
      setPlanActivated(true);
      setStep("addons");
      return;
    }
    setError(null);
    const res = await fetch("/api/settings/subscription/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: recommendedTier }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(apiErrorMessage(json, "Could not change plan"));
      return;
    }
    setPlanActivated(true);
    setStep("addons");
    router.refresh();
  }

  async function activateAddon(slug: string) {
    setError(null);
    const res = await fetch("/api/marketplace/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(apiErrorMessage(json, `Could not activate ${slug}`));
      return false;
    }
    setActivatedSlugs((prev) => new Set(prev).add(slug));
    return true;
  }

  async function activateAllAddons() {
    if (!pricing) return;
    const purchasable = pricing.lines.filter(
      (line) => !line.comingSoon && !line.active && !line.includedInTier,
    );
    for (const line of purchasable) {
      const ok = await activateAddon(line.slug);
      if (!ok) return;
    }
    setStep("done");
  }

  const optionalAddons =
    bundle?.addons.filter((a) => a.optional) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Sparkles className="h-6 w-6" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-bold text-ink dark:text-cream-100">
          Welcome, {businessName}
        </h1>
        <p className="text-sm text-ink-muted dark:text-cream-400">
          {planResult?.headline ??
            "Here is a suggested plan and optional pack for your business."}
        </p>
        {planResult?.summary ? (
          <p className="text-sm text-ink-muted dark:text-cream-400">
            {planResult.summary}
          </p>
        ) : null}
      </header>

      {bundle && pricing ? (
        <section className="rounded-2xl border border-cream-300 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-200" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-ink dark:text-cream-100">
                {bundle.name}
              </h2>
              <p className="text-sm text-ink-muted dark:text-cream-400">
                {bundle.tagline}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-cream-100/80 p-4 dark:bg-hairline-dark/40">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Bundle total (estimate)
                </p>
                <p className="text-2xl font-bold text-ink dark:text-cream-100">
                  {formatMyr(pricing.totalBundleCents)}
                  <span className="text-sm font-normal text-ink-muted">/month</span>
                </p>
                {pricing.savingsCents > 0 ? (
                  <p className="mt-1 text-xs text-status-success">
                    Jimat {formatMyr(pricing.savingsCents)} on add-ons vs à la carte
                    ({Math.round(BUNDLE_ADDON_DISCOUNT_RATE * 100)}% bundle discount)
                  </p>
                ) : null}
              </div>
              {pricing.totalAlaCarteCents > pricing.totalBundleCents ? (
                <p className="text-sm text-ink-muted line-through dark:text-cream-500">
                  {formatMyr(pricing.totalAlaCarteCents)}/mo separate
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle dark:text-cream-500">
              Phase 1: activate plan and add-ons below one by one. One-click &quot;Activate
              pack&quot; with billing discount ships in Phase 2.
            </p>
          </div>
        </section>
      ) : null}

      {step === "plan" ? (
        <section className="space-y-4 rounded-2xl border border-cream-300 bg-white p-5 dark:border-hairline-dark dark:bg-panel-dark">
          <h3 className="text-base font-semibold text-ink dark:text-cream-100">
            Step 1 — Your plan
          </h3>
          <div className="rounded-xl border border-cream-300 p-4 dark:border-hairline-dark">
            <p className="font-semibold text-ink dark:text-cream-100">
              {recommendedTierMeta?.label ?? recommendedTier}
              {recommendedTierMeta?.priceMyr != null
                ? ` — RM${recommendedTierMeta.priceMyr}/month`
                : ""}
            </p>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              {needsPlanUpgrade
                ? `You are on ${tierBy(currentTier)?.label ?? currentTier} today. We suggest upgrading to unlock this pack.`
                : planResult?.canStayFree
                  ? "You can stay on Free and add paid modules later."
                  : "Your current plan already fits this recommendation."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {needsPlanUpgrade ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void activatePlan()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Switch to {recommendedTierMeta?.label}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPlanActivated(true);
                  setStep("addons");
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {planResult?.canStayFree ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void finishOnboarding("/home")}
                className="rounded-xl border border-cream-300 px-4 py-3 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-100"
              >
                Stay on Free
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === "addons" && pricing ? (
        <section className="space-y-4 rounded-2xl border border-cream-300 bg-white p-5 dark:border-hairline-dark dark:bg-panel-dark">
          <h3 className="text-base font-semibold text-ink dark:text-cream-100">
            Step 2 — Add-ons in this pack
          </h3>
          <p className="text-sm text-ink-muted dark:text-cream-400">
            Tick optional extras, then activate each add-on. Payroll is never selected by
            default.
          </p>

          {optionalAddons.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-dashed border-cream-300 p-3 dark:border-hairline-dark">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Optional
              </p>
              {optionalAddons.map((ref) => {
                const checked = optionalSelected.has(ref.slug);
                return (
                  <label
                    key={ref.slug}
                    className="flex cursor-pointer items-start gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setOptionalSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(ref.slug)) next.delete(ref.slug);
                          else next.add(ref.slug);
                          return next;
                        });
                      }}
                      className="mt-1 h-4 w-4 rounded border-cream-300 text-brand-500"
                    />
                    <span>
                      <span className="font-medium text-ink dark:text-cream-100">
                        {catalogBySlug.get(ref.slug)?.name ??
                          ref.plannedLabel ??
                          ref.slug}
                      </span>
                      {ref.optionalHint ? (
                        <span className="block text-xs text-ink-muted dark:text-cream-400">
                          {ref.optionalHint}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {pricing.lines.map((line) => (
              <li
                key={line.slug}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-cream-100">
                    {line.name}
                    {line.optional ? (
                      <span className="ml-2 text-[10px] uppercase text-ink-subtle">
                        Optional
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {line.comingSoon
                      ? "Coming soon in Marketplace"
                      : line.includedInTier
                        ? "Included in your plan"
                        : line.active
                          ? "Already active"
                          : line.priceCents === 0
                            ? "Free add-on"
                            : formatMyr(line.priceCents) + "/month"}
                  </p>
                </div>
                <div className="shrink-0">
                  {line.active || line.includedInTier ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-success">
                      <Check className="h-3.5 w-3.5" />
                      Active
                    </span>
                  ) : line.comingSoon ? (
                    <span className="text-xs font-semibold text-ink-subtle">Soon</span>
                  ) : currentTier === "starter" && !planActivated ? (
                    <span className="text-xs text-ink-muted">Needs paid plan</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void activateAddon(line.slug)}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending || currentTier === "starter"}
              onClick={() => void activateAllAddons()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Activate all available
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep("done")}
              className="rounded-xl border border-cream-300 px-4 py-3 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
            >
              I&apos;ll do this later
            </button>
          </div>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="rounded-2xl border border-status-success/30 bg-status-success/5 p-5 text-center">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            You&apos;re set for now.
          </p>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Add more from Marketplace any time — à la carte stays at full price.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void finishOnboarding("/home")}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Go to dashboard
          </button>
        </section>
      ) : null}

      <footer
        className={cn(
          "flex flex-col items-center gap-2 border-t border-cream-200 pt-4 text-center dark:border-hairline-dark",
        )}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => void finishOnboarding("/home")}
          className="text-sm font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
        >
          Skip — I&apos;ll choose myself
        </button>
        <Link
          href="/settings/subscription"
          className="text-sm font-medium text-brand-700 dark:text-brand-200"
        >
          Compare all plans manually →
        </Link>
        <Link
          href="/marketplace"
          className="text-sm font-medium text-brand-700 dark:text-brand-200"
        >
          Browse Marketplace à la carte →
        </Link>
      </footer>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
