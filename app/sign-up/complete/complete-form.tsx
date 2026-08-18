"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupLanguageCards } from "@/components/auth/SignupLanguageCards";
import { signOutAction } from "@/app/sign-in/actions";
import { apiErrorMessage } from "@/lib/api/client-error";
import { readQuizFromSession } from "@/lib/onboarding/session-quiz";

const STATES = [
  { code: "KUL", label: "Kuala Lumpur" },
  { code: "SGR", label: "Selangor" },
  { code: "JHR", label: "Johor" },
  { code: "PNG", label: "Pulau Pinang" },
  { code: "PRK", label: "Perak" },
  { code: "PHG", label: "Pahang" },
  { code: "NSN", label: "Negeri Sembilan" },
  { code: "MLK", label: "Melaka" },
  { code: "KDH", label: "Kedah" },
  { code: "KTN", label: "Kelantan" },
  { code: "TRG", label: "Terengganu" },
  { code: "PLS", label: "Perlis" },
  { code: "SBH", label: "Sabah" },
  { code: "SWK", label: "Sarawak" },
  { code: "LBN", label: "Labuan" },
  { code: "PJY", label: "Putrajaya" },
] as const;

type SignupPath = "free" | "starter_trial";

const inputCx =
  "block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

export function CompleteGoogleSignupForm({ email }: { email: string }) {
  const router = useRouter();
  const [signupPath, setSignupPath] = useState<SignupPath>("free");
  const [businessName, setBusinessName] = useState("");
  const [stateCode, setStateCode] = useState("KUL");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState<"en" | "ms" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!preferredLocale) {
      setError("Choose English or Bahasa Melayu.");
      return;
    }
    if (!acceptTerms) {
      setError("Accept the terms to continue.");
      return;
    }
    setPending(true);
    try {
      const sessionQuiz = readQuizFromSession();
      const res = await fetch("/api/auth/complete-google-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          state_code: stateCode,
          accept_terms: acceptTerms,
          signup_path: signupPath,
          preferred_locale: preferredLocale,
          ...(sessionQuiz
            ? {
                onboarding_quiz: {
                  business_type: sessionQuiz.businessType,
                  team_size_band: sessionQuiz.teamSize,
                  priorities: sessionQuiz.priorities,
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.replace("/sign-in");
        return;
      }
      if (!res.ok) {
        setError(apiErrorMessage(json, "Could not create account"));
        setPending(false);
        return;
      }
      if (json.already_complete === true) {
        router.replace("/home");
        router.refresh();
        return;
      }
      router.replace("/onboarding/recommendation");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
      setPending(false);
    }
  }

  return (
    <AuthShell
      brandHeading={
        signupPath === "free"
          ? "Start free — invoices and payments."
          : "Start your 7-day Basic trial."
      }
      brandSubheading={
        signupPath === "free"
          ? "No card required. Upgrade when you need expenses, stock, or staff."
          : "No card required. Activate add-ons later from the Marketplace."
      }
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Create your business
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Finish the same details as email sign-up. Your Google email is already
          signed in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSignupPath("free")}
          className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
            signupPath === "free"
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
              : "border-cream-300 bg-white hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark"
          }`}
        >
          <span className="block font-semibold text-ink dark:text-cream-100">
            Start free
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted dark:text-cream-400">
            Invoices & payments — no card
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSignupPath("starter_trial")}
          className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
            signupPath === "starter_trial"
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
              : "border-cream-300 bg-white hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark"
          }`}
        >
          <span className="block font-semibold text-ink dark:text-cream-100">
            7-day Basic trial
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted dark:text-cream-400">
            Admin, Sales, and Finance · 20 credits
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <SignupLanguageCards
          value={preferredLocale}
          onChange={setPreferredLocale}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Business name
          </span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Nasi Lemak Berkat SDN BHD"
            autoComplete="organization"
            required
            className={inputCx}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Operating state
          </span>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className={`${inputCx} appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-9`}
          >
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Work email
          </span>
          <input
            type="email"
            value={email}
            readOnly
            className={`${inputCx} bg-cream-50 text-ink-muted dark:bg-hairline-dark/40`}
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark"
          />
          <span className="text-ink-muted dark:text-cream-400">
            I&apos;ve read and accept the{" "}
            <Link
              href="/legal/terms"
              className="font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Privacy Policy
            </Link>{" "}
            (PDPA-aligned).
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger dark:bg-status-danger/20"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !acceptTerms}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          )}
          {signupPath === "free"
            ? "Create business — Free"
            : "Create business & start trial"}
        </button>
      </form>

      <form action={signOutAction} className="text-center">
        <button
          type="submit"
          className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Use a different account
        </button>
      </form>
    </AuthShell>
  );
}
