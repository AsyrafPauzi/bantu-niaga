"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { apiErrorMessage } from "@/lib/api/client-error";

function VerifyEmailInner() {
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const initialDevLink = params.get("dev_link");
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(Boolean(initialDevLink));
  const [devLink, setDevLink] = useState<string | null>(initialDevLink);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleResend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(json, "Could not resend verification email"));
        return;
      }
      setSent(true);
      if (typeof json.dev_verification_link === "string") {
        setDevLink(json.dev_verification_link);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      brandHeading="Almost there — verify your email."
      brandSubheading="We sent a secure link to your inbox. Click it to unlock your business workspace."
    >
      <div>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to sign in
        </Link>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink dark:text-cream-100">
          Verify your email
        </h2>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Your account is created but locked until you confirm{" "}
          {initialEmail ? (
            <strong className="text-ink dark:text-cream-100">{initialEmail}</strong>
          ) : (
            "your email"
          )}
          . Check spam if you don&apos;t see it within a minute.
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
                Link sent again
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                If <strong>{email}</strong> matches an unverified account, a new
                link is on its way.
              </p>
            </div>
          </div>
          {devLink ? (
            <p className="break-all rounded-lg bg-white/80 p-3 text-xs text-ink-muted dark:bg-panel-dark dark:text-cream-400">
              Dev link:{" "}
              <a href={devLink} className="font-semibold text-brand-700">
                {devLink}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleResend} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
            Work email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
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
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Resend verification email
        </button>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
