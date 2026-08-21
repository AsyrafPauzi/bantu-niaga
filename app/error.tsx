"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js segment-level error boundary.
 * Catches render-time and async errors inside (app) routes.
 * The raw `error.message` and stack are intentionally never shown to the user.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to server console / your observability platform.
    // Never expose error.message or error.stack to the DOM.
    console.error("[AppError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40">
        <AlertTriangle className="h-7 w-7 text-red-500 dark:text-red-400" />
      </span>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-ink dark:text-cream-100">
          Something didn&apos;t load correctly
        </h1>
        <p className="max-w-sm text-sm text-ink-muted dark:text-cream-400">
          We ran into a problem loading this page. Your data is safe — nothing
          was changed or deleted.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-ink-muted/60 dark:text-cream-500/50">
            Error ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <RefreshCw size={14} />
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center rounded-xl border border-hairline-light px-4 py-2 text-sm font-medium text-ink-muted transition hover:text-ink dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
