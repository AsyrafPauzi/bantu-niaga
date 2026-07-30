"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { socialAuthErrorMessage } from "@/lib/auth/social-login";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <AuthShell
      brandHeading="Run your entire business from one screen."
      brandSubheading="Finance, sales, inventory, HR, marketing — unified with AI Boardroom for Malaysian SMEs."
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          {params.get("reason") === "switch_account"
            ? "Sign in with the account for the company you want to open."
            : "Sign in to keep managing your business."}
        </p>
      </div>

      {!isPublicStandaloneDeployment() ? (
        <>
          <GoogleSignInButton
            nextPath={params.get("next") || "/home"}
            onError={setError}
          />

          <div className="flex items-center gap-3 text-xs text-ink-subtle dark:text-cream-400">
            <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
            OR SIGN IN WITH EMAIL
            <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-ink dark:text-cream-100">Email</span>
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
          <span className="font-medium text-ink dark:text-cream-100">Password</span>
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
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2 text-ink-muted dark:text-cream-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Forgot password?
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
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-ink-muted dark:text-cream-400">
        {isPublicStandaloneDeployment() ? (
          <>Sign in with the account your administrator created.</>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Start a 14-day trial
            </Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}
