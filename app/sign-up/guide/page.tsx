"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  recommendPlanFromQuiz,
  type BusinessType,
  type PlanQuizAnswers,
  type PriorityNeed,
  type TeamSizeBand,
} from "@/lib/onboarding/plan-quiz";
import { writeQuizToSession } from "@/lib/onboarding/session-quiz";
import { tierBy } from "@/lib/settings/plans";

const BUSINESS_TYPES: { id: BusinessType; label: string }[] = [
  { id: "retail", label: "Kedai runcit / retail" },
  { id: "fnb", label: "Kafe / F&B" },
  { id: "services", label: "Salon / servis" },
  { id: "online", label: "Jual online" },
  { id: "freelancer", label: "Freelancer / solo" },
  { id: "other", label: "Lain-lain" },
];

const TEAM_SIZES: { id: TeamSizeBand; label: string }[] = [
  { id: "solo", label: "Sendiri" },
  { id: "2-5", label: "2–5 orang" },
  { id: "6-15", label: "6–15 orang" },
  { id: "16+", label: "16+ orang" },
];

const PRIORITIES: { id: PriorityNeed; label: string }[] = [
  { id: "invoices", label: "Invois & bayaran" },
  { id: "pos", label: "Jualan kaunter" },
  { id: "stock", label: "Stok" },
  { id: "leave", label: "Cuti staff" },
  { id: "marketing", label: "Marketing pelanggan" },
];

export default function SignUpGuidePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [teamSize, setTeamSize] = useState<TeamSizeBand | null>(null);
  const [priorities, setPriorities] = useState<PriorityNeed[]>([]);

  const result = useMemo(() => {
    if (step < 3 || !businessType || !teamSize) return null;
    const answers: PlanQuizAnswers = { businessType, teamSize, priorities };
    return recommendPlanFromQuiz(answers);
  }, [step, businessType, teamSize, priorities]);

  function togglePriority(id: PriorityNeed) {
    setPriorities((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  const recommendedTier = result ? tierBy(result.recommendedTier) : null;

  function goToSignUp(path: "free" | "starter_trial") {
    if (businessType && teamSize) {
      const answers: PlanQuizAnswers = {
        businessType,
        teamSize,
        priorities,
      };
      writeQuizToSession(answers);
    }
    router.push(path === "free" ? "/sign-up?path=free" : "/sign-up?path=starter_trial");
  }

  return (
    <AuthShell
      brandHeading="Find a plan that fits your business."
      brandSubheading="30 seconds — skippable anytime. Free is always an option."
    >
      <div>
        <Link
          href="/sign-up"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign-up
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Help me choose
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Step {Math.min(step + 1, 3)} of 3 — we will suggest a plan, never lock you in.
        </p>
      </div>

      {step === 0 ? (
        <ChoiceStep
          title="Apa jenis perniagaan anda?"
          options={BUSINESS_TYPES}
          selected={businessType}
          onSelect={(id) => setBusinessType(id as BusinessType)}
          onNext={() => setStep(1)}
          canNext={!!businessType}
        />
      ) : null}

      {step === 1 ? (
        <ChoiceStep
          title="Berapa orang team?"
          options={TEAM_SIZES}
          selected={teamSize}
          onSelect={(id) => setTeamSize(id as TeamSizeBand)}
          onNext={() => setStep(2)}
          canNext={!!teamSize}
          onBack={() => setStep(0)}
        />
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-ink dark:text-cream-100">
            Apa yang paling penting sekarang?
          </h3>
          <p className="text-sm text-ink-muted dark:text-cream-400">
            Pilih sehingga 2.
          </p>
          <div className="grid gap-2">
            {PRIORITIES.map((opt) => {
              const active = priorities.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePriority(opt.id)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100"
                      : "border-cream-300 bg-white text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              See recommendation
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && result && recommendedTier ? (
        <div className="space-y-5 rounded-2xl border border-cream-300 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
                Cadangan
              </p>
              <h3 className="text-xl font-bold text-ink dark:text-cream-100">
                {result.headline}
              </h3>
              <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
                {result.summary}
              </p>
              {recommendedTier.priceMyr !== null && result.recommendedTier !== "starter" ? (
                <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
                  {recommendedTier.label} — RM{recommendedTier.priceMyr}/month
                </p>
              ) : null}
              {result.bundleHint ? (
                <p className="mt-2 text-xs text-ink-subtle dark:text-cream-500">
                  {result.bundleHint}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {result.canStayFree ? (
              <button
                type="button"
                onClick={() => goToSignUp("free")}
                className="h-11 rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Continue on Free
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToSignUp("starter_trial")}
                className="h-11 rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Start 14-day Starter trial
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                goToSignUp(result.canStayFree ? "starter_trial" : "free")
              }
              className="h-11 rounded-lg border border-cream-300 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-100"
            >
              {result.canStayFree ? "Try Starter trial instead" : "Start on Free instead"}
            </button>
            <Link
              href="/sign-up"
              className="text-center text-sm font-medium text-brand-700 dark:text-brand-200"
            >
              Create account with this plan →
            </Link>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}

function ChoiceStep<T extends string>({
  title,
  options,
  selected,
  onSelect,
  onNext,
  canNext,
  onBack,
}: {
  title: string;
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
  onNext: () => void;
  canNext: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-ink dark:text-cream-100">{title}</h3>
      <div className="grid gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
              selected === opt.id
                ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-100"
                : "border-cream-300 bg-white text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-cream-300 px-4 py-2.5 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-cream-300 dark:disabled:bg-hairline-dark"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
