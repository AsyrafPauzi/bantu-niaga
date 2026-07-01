"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { apiErrorMessage } from "@/lib/api/client-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Guard: if there's no recovery session in the cookie, the user
  // probably navigated here directly. Tell them and link back.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user);
    });
  }, []);

  const lengthOk = password.length >= 12;
  const upperOk = /[A-Z]/.test(password);
  const lowerOk = /[a-z]/.test(password);
  const numberOk = /[0-9]/.test(password);
  const matchOk = password.length > 0 && password === confirm;
  const passwordOk = lengthOk && upperOk && lowerOk && numberOk && matchOk;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passwordOk) {
      setError("Fix the rules below before continuing.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(json, "Reset failed"));
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.replace("/home");
        router.refresh();
      }, 1500);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      brandHeading="Pick a new password and you're in."
      brandSubheading="Once you confirm, every other device is signed out automatically — your account is fresh."
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Set a new password
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Choose something memorable but strong. We use bcrypt and never store
          the raw value.
        </p>
      </div>

      {hasSession === false ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-status-danger/20 text-status-danger">
              <KeyRound className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Reset link expired or invalid
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Request a fresh reset link from the sign-in page. Links are
                single-use and last 60 minutes.
              </p>
            </div>
          </div>
          <Link
            href="/forgot-password"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Send a new link
          </Link>
        </div>
      ) : done ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-5">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Password updated. Redirecting you home…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
              New password
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                placeholder="Min 12 characters · upper + lower + number"
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
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
              Confirm password
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Type it again"
              className={inputCx}
            />
          </label>

          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-muted dark:text-cream-400">
            <PwdRule ok={lengthOk}>12+ characters</PwdRule>
            <PwdRule ok={upperOk}>One uppercase letter</PwdRule>
            <PwdRule ok={lowerOk}>One lowercase letter</PwdRule>
            <PwdRule ok={numberOk}>One number</PwdRule>
            <PwdRule ok={matchOk}>Both fields match</PwdRule>
          </ul>

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
            disabled={pending || !passwordOk}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2} />
            )}
            Set new password
          </button>
        </form>
      )}

      <p className="text-center text-sm text-ink-muted dark:text-cream-400">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Back to sign in
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
