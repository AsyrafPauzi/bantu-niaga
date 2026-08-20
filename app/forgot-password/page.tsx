"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuthLocale } from "@/components/auth/useAuthLocale";
import { apiErrorMessage } from "@/lib/api/client-error";
import { isPublicStandaloneDeployment } from "@/lib/platform/deployment";

export default function ForgotPasswordPage() {
  const { locale } = useAuthLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(json, "Could not send reset link"));
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      locale={locale}
      brandHeading={
        locale === "ms"
          ? "Terkunci? Kami hantar anda masuk semula."
          : "Locked out? We'll send you back in."
      }
      brandSubheading={
        locale === "ms"
          ? "Pautan set semula sekali guna sampai ke peti masuk dalam seminit. Pautan tamat dalam 60 minit demi keselamatan."
          : "A one-time reset link lands in your inbox within a minute. The link expires in 60 minutes for safety."
      }
    >
      <ForgotForm
        email={email}
        setEmail={setEmail}
        sent={sent}
        setSent={setSent}
        error={error}
        pending={pending}
        onSubmit={handleSubmit}
      />
    </AuthShell>
  );
}

function ForgotForm({
  email,
  setEmail,
  sent,
  setSent,
  error,
  pending,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  sent: boolean;
  setSent: (v: boolean) => void;
  error: string | null;
  pending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const t = useTranslations("auth");

  return (
    <>
      <div>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          {t("backToSignIn")}
        </Link>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          {t("resetTitle")}
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          {t("resetSubtitle")}
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 rounded-xl border border-status-success/30 bg-status-success/10 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-status-success/20 text-status-success">
              <Mail className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                {t("checkInbox")}
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {t("resetSentBody", { email })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            {t("tryAnotherEmail")}
          </button>
        </div>
      ) : (
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
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-cream-300"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : null}
            {pending ? t("sending") : t("sendReset")}
          </button>
        </form>
      )}

      {isPublicStandaloneDeployment() ? null : (
        <p className="text-center text-sm text-ink-muted dark:text-cream-400">
          {t("noAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            {t("signUp")}
          </Link>
        </p>
      )}
    </>
  );
}
