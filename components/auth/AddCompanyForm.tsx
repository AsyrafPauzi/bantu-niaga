"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

export function AddCompanyForm({
  ownedCount,
  maxOwned,
}: {
  ownedCount: number;
  maxOwned: number;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [stateCode, setStateCode] = useState<string>("KUL");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError("Accept the terms to continue.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/add-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          business_name: businessName,
          state_code: stateCode,
          accept_terms: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(json, "Could not create company"));
        return;
      }
      router.replace("/home");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Building2 className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
            Add a company
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Create another business under your login. Confirm your password,
            then switch between companies from the sidebar — no need to sign out.
          </p>
          <p className="mt-2 text-xs text-ink-subtle dark:text-cream-500">
            {ownedCount} of {maxOwned} companies owned on this account.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-cream-300 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Company name
          </span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Kedai Runcit Maju SDN BHD"
            required
            className={inputCx}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            State (for public holidays)
          </span>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className={inputCx}
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
            Your password
          </span>
          <span className="mb-1.5 block text-xs text-ink-muted dark:text-cream-400">
            Re-enter your Bantu Niaga password to confirm it&apos;s you.
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Current password"
              className={`${inputCx} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink dark:text-cream-400"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>
        </label>

        <label className="flex items-start gap-2 text-sm text-ink-muted dark:text-cream-400">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1"
          />
          <span>
            I accept the{" "}
            <Link href="/legal/terms" className="font-semibold text-brand-700 dark:text-brand-200">
              terms
            </Link>{" "}
            for this new company.
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Check className="h-4 w-4" strokeWidth={2} />
          )}
          Create company &amp; switch
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-muted dark:text-cream-400">
        Need to use a different email?{" "}
        <button
          type="button"
          className="font-semibold text-brand-700 dark:text-brand-200"
          onClick={async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.push("/sign-in?reason=switch_account");
          }}
        >
          Sign in with another account
        </button>
      </p>
    </div>
  );
}

const inputCx =
  "block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100";
