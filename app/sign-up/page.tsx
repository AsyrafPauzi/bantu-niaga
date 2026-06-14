"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
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

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [stateCode, setStateCode] = useState<string>("KUL");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Real-time password rule checks
  const lengthOk = password.length >= 12;
  const upperOk = /[A-Z]/.test(password);
  const lowerOk = /[a-z]/.test(password);
  const numberOk = /[0-9]/.test(password);
  const passwordOk = lengthOk && upperOk && lowerOk && numberOk;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError("Accept the terms to continue.");
      return;
    }
    if (!passwordOk) {
      setError("Password doesn't meet the requirements yet.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          business_name: businessName,
          state_code: stateCode,
          accept_terms: acceptTerms,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json?.issues?.[0]?.message ??
            json?.message ??
            json?.error ??
            "Could not create account",
        );
        setPending(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(
          "Account created but auto-sign-in failed. Sign in manually with the credentials you just chose.",
        );
        setPending(false);
        return;
      }

      router.replace("/home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed");
      setPending(false);
    }
  }

  return (
    <AuthShell
      brandHeading="Start your 14-day Starter trial."
      brandSubheading="No card required. Activate WhatsApp Business, Boost Credits, or any add-on later from the Marketplace."
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Create your business
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          One owner account · 14 days of Starter on us · upgrade any time.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Business name">
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Nasi Lemak Berkat SDN BHD"
            autoComplete="organization"
            required
            className={inputCx}
          />
        </Field>

        <Field label="Operating state">
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className={`${inputCx} appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-9`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12'%3E%3Cpath fill='%2378716C' d='M6 8 1 3h10z'/%3E%3C/svg%3E\")",
            }}
          >
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Work email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            autoComplete="email"
            required
            className={inputCx}
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 12 characters · upper + lower + number"
              autoComplete="new-password"
              required
              className={`${inputCx} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-muted dark:text-cream-400">
            <PwdRule ok={lengthOk}>12+ characters</PwdRule>
            <PwdRule ok={upperOk}>One uppercase letter</PwdRule>
            <PwdRule ok={lowerOk}>One lowercase letter</PwdRule>
            <PwdRule ok={numberOk}>One number</PwdRule>
          </ul>
        </Field>

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
          disabled={pending || !passwordOk || !acceptTerms}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          )}
          Create business &amp; start trial
        </button>
      </form>

      <p className="text-center text-sm text-ink-muted dark:text-cream-400">
        Already running on Bantu Niaga?{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function PwdRule({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 ${
        ok ? "text-status-success" : ""
      }`}
    >
      {ok ? (
        <Check className="h-3 w-3" strokeWidth={3} />
      ) : (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      )}
      {children}
    </li>
  );
}

const inputCx =
  "block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
        {label}
      </span>
      {children}
    </label>
  );
}
