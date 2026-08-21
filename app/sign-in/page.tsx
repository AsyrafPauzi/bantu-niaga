"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { socialAuthErrorMessage } from "@/lib/auth/social-login";
import type { AppLocale } from "@/lib/i18n/locale";
import {
  readPreferredLocaleCookie,
  writePreferredLocaleCookie,
} from "@/lib/i18n/preferred-locale-cookie";
import { isPublicStandaloneDeployment } from "@/lib/platform/deployment";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [locale, setLocale] = useState<AppLocale>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // MFA step
  const [mfaStep, setMfaStep] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  useEffect(() => {
    setLocale(readPreferredLocaleCookie());
  }, []);

  useEffect(() => {
    const flash = params.get("auth_error");
    const reason = params.get("reason");
    if (reason === "switch_account") {
      setError(null);
    }
    if (flash) {
      setError(socialAuthErrorMessage(flash));
    }
  }, [params]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes("confirm") || msg.includes("verified")) {
          router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
          setSubmitting(false);
          return;
        }
        setError(signInError.message);
        setSubmitting(false);
        return;
      }

      const {
        data: { user: signedInUser },
      } = await supabase.auth.getUser();

      if (signedInUser && !signedInUser.email_confirmed_at) {
        await supabase.auth.signOut();
        router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
        setSubmitting(false);
        return;
      }

      // Check if user has a verified TOTP factor — challenge it regardless of AAL policy
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");
      if (verifiedTotp) {
        setMfaStep({ factorId: verifiedTotp.id });
        setSubmitting(false);
        return;
      }

      await fetch("/api/settings/security/sessions/register", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {
        // Session tracking is best-effort; sign-in still succeeds.
      });

      router.replace(params.get("next") || "/home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  async function handleMfa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mfaStep) return;
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: mfaStep.factorId,
      });
      if (chErr || !ch) {
        setMfaError(chErr?.message ?? "Could not start MFA challenge.");
        return;
      }
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: mfaStep.factorId,
        challengeId: ch.id,
        code: mfaCode,
      });
      if (verErr) {
        setMfaError("Invalid code. Check your authenticator app and try again.");
        return;
      }
      await fetch("/api/settings/security/sessions/register", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {});
      router.replace(params.get("next") || "/home");
      router.refresh();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "MFA failed.");
    } finally {
      setMfaSubmitting(false);
    }
  }

  return (
    <AuthShell
      locale={locale}
      brandHeading={
        locale === "ms"
          ? "Urus seluruh bisnes dari satu skrin."
          : "Run your entire business from one screen."
      }
      brandSubheading={
        locale === "ms"
          ? "Kewangan, jualan, inventori, HR, pemasaran — disatukan dengan Bilik mesyuarat untuk PKS Malaysia."
          : "Finance, sales, inventory, HR, marketing — unified with Boardroom for Malaysian SMEs."
      }
    >
      {mfaStep ? (
        <MfaForm
          code={mfaCode}
          setCode={setMfaCode}
          error={mfaError}
          submitting={mfaSubmitting}
          onSubmit={handleMfa}
          onBack={() => { setMfaStep(null); setMfaCode(""); setMfaError(null); }}
        />
      ) : (
        <SignInForm
          locale={locale}
          onLocaleChange={(next) => {
            writePreferredLocaleCookie(next);
            setLocale(next);
          }}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          remember={remember}
          setRemember={setRemember}
          error={error}
          submitting={submitting}
          onSubmit={handleSubmit}
          switchAccount={params.get("reason") === "switch_account"}
          nextPath={params.get("next") || "/home"}
          onError={setError}
        />
      )}
    </AuthShell>
  );
}

function MfaForm({
  code,
  setCode,
  error,
  submitting,
  onSubmit,
  onBack,
}: {
  code: string;
  setCode: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Two-factor check
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Open your authenticator app and enter the 6-digit code.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-ink dark:text-cream-100">
            Authenticator code
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="mt-1.5 block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-center font-mono text-2xl tracking-[0.5em] text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
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
          disabled={submitting || code.length !== 6}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
          {submitting ? "Verifying…" : "Verify & sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="block text-center text-sm text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        ← Back to sign in
      </button>
    </div>
  );
}

function SignInForm({
  locale,
  onLocaleChange,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  remember,
  setRemember,
  error,
  submitting,
  onSubmit,
  switchAccount,
  nextPath,
  onError,
}: {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  switchAccount: boolean;
  nextPath: string;
  onError: (msg: string) => void;
}) {
  const t = useTranslations("auth");

  return (
    <>
      <div className="flex items-center justify-end gap-2 text-xs">
        <span className="text-ink-muted dark:text-cream-400">
          {t("languageToggle")}
        </span>
        <button
          type="button"
          onClick={() => onLocaleChange("en")}
          className={
            locale === "en"
              ? "font-semibold text-brand-700 dark:text-brand-200"
              : "text-ink-muted hover:text-ink dark:text-cream-400"
          }
        >
          EN
        </button>
        <span className="text-ink-subtle">/</span>
        <button
          type="button"
          onClick={() => onLocaleChange("ms")}
          className={
            locale === "ms"
              ? "font-semibold text-brand-700 dark:text-brand-200"
              : "text-ink-muted hover:text-ink dark:text-cream-400"
          }
        >
          MS
        </button>
      </div>

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          {t("welcomeBack")}
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          {switchAccount ? t("switchAccount") : t("signInSubtitle")}
        </p>
      </div>

      {!isPublicStandaloneDeployment() ? (
        <>
          <GoogleSignInButton nextPath={nextPath} onError={onError} />

          <div className="flex items-center gap-3 text-xs text-ink-subtle dark:text-cream-400">
            <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
            {t("orEmail")}
            <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-ink dark:text-cream-100">
            {t("email")}
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className="mt-1.5 block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-ink dark:text-cream-100">
            {t("password")}
          </span>
          <div className="relative mt-1.5">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 pr-10 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-ink-muted dark:text-cream-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark"
            />
            {t("rememberMe")}
          </label>
          <Link
            href="/forgot-password"
            className="font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            {t("forgotPassword")}
          </Link>
        </div>

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
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : null}
          {submitting ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <p className="text-center text-sm text-ink-muted dark:text-cream-400">
        {isPublicStandaloneDeployment() ? (
          <>{t("adminCreated")}</>
        ) : (
          <>
            {t("noAccount")}{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              {t("startTrial")}
            </Link>
          </>
        )}
      </p>
    </>
  );
}
