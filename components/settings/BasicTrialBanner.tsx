"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "niagax.basic-trial-banner-dismissed";

function startTrialErrorMessage(error: unknown): string {
  if (error === "trial_already_used" || error === "invalid_status") {
    return "This business already used its trial.";
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Could not start the trial.";
}

export function BasicTrialBanner() {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota */
    }
    setHidden(true);
  }

  async function startTrial() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/subscription/start-basic-trial", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(startTrialErrorMessage(json.error));
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not start the trial.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border-b border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink dark:border-brand-800 dark:bg-brand-900/30 dark:text-cream-100">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Try Basic for 7 days</p>
        <p className="mt-0.5 text-ink-muted dark:text-cream-400">
          20 AI credits. No card. Upgrade to Basic, Solo, or another paid plan any time.
        </p>
        {error ? <p className="mt-1 text-status-danger">{error}</p> : null}
        <button
          type="button"
          onClick={() => void startTrial()}
          disabled={pending}
          className="mt-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start 7-day Basic trial"}
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-ink-muted hover:bg-brand-100 dark:hover:bg-brand-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
