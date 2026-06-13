"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setError(signInError.message);
        setSubmitting(false);
        return;
      }

      router.replace("/home");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-cream-100 text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Brand panel — visible only on lg+ */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-500 px-14 py-12 text-white lg:flex">
          <Link href="/" className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-card">
            <Image
              src="/icon.png"
              alt="Bantu Niaga"
              width={36}
              height={36}
              priority
              className="h-9 w-9 shrink-0"
            />
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-brand-700">
                Bantu <span className="text-accent-500">Niaga</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                SME Operating System
              </span>
            </span>
          </Link>

          <div className="max-w-md space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-200">
              AI Business Operating System
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-[44px]">
              Run your entire business from one screen.
            </h1>
            <p className="text-base leading-relaxed text-brand-100">
              Finance, sales, inventory, HR, marketing — unified with AI
              Boardroom for Malaysian SMEs.
            </p>
            <dl className="grid grid-cols-3 gap-6 pt-4">
              <div>
                <dt className="text-3xl font-bold text-white">6</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  Pilar bersepadu
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">24/7</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  AI penasihat
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">100%</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  Lokal Malaysia
                </dd>
              </div>
            </dl>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-brand-100">
            <ShieldCheck className="h-4 w-4 text-accent-300" strokeWidth={2} />
            PDPA &amp; Bank Negara aligned · Supabase Singapore region
          </p>
        </aside>

        {/* Form panel */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile logo */}
            <div className="flex items-center justify-center gap-3 lg:hidden">
              <Image
                src="/icon.png"
                alt="Bantu Niaga"
                width={48}
                height={48}
                priority
                className="h-12 w-12"
              />
              <span className="text-xl font-bold tracking-tight">
                <span className="text-brand-700 dark:text-brand-200">Bantu</span>{" "}
                <span className="text-accent-500">Niaga</span>
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
                Sign in to keep managing your business.
              </p>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-cream-300 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-ink-subtle dark:text-cream-400">
              <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
              OR SIGN IN WITH EMAIL
              <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-ink dark:text-cream-100">
                  Email
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
                  Password
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
                  href="/sign-in"
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
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="text-center text-sm text-ink-muted dark:text-cream-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Request access
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.2 3 9.4 7.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.3 0 10-2 13.5-5.3l-6.2-5.2C29.3 36.1 26.8 37 24 37c-5.1 0-9.5-3.2-11.2-7.7l-6.5 5C9.4 40.4 16.2 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
