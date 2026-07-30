"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Receipt,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

const STORAGE_PREFIX = "bn-finance-guide-v1:";

const STEPS = [
  {
    title: "Welcome to Finance",
    body: "Track money in and out, send invoices, and know if you are making money — without accounting jargon.",
    href: null as string | null,
    cta: null as string | null,
    icon: Wallet,
  },
  {
    title: "1 · Log an expense",
    body: "Snap daily spending — rent, supplies, petrol. Attach a receipt from Admin Storage when you have one.",
    href: "/finance/expenses",
    cta: "Log expense",
    icon: Receipt,
  },
  {
    title: "2 · Send an invoice",
    body: "Bill customers with a share link. They can view and pay via DuitNow when you enable it on the invoice.",
    href: "/finance/invoices/new",
    cta: "New invoice",
    icon: FileText,
  },
  {
    title: "3 · Ask Fayza",
    body: "Fayza reads your real numbers — cash flow, unpaid invoices, and what to log before month-end.",
    href: "/finance/assistant",
    cta: "Chat with Fayza",
    icon: Sparkles,
  },
] as const;

function storageKey(businessId: string) {
  return `${STORAGE_PREFIX}${businessId}`;
}

export function FinanceGuideJourney({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(businessId)) === "done") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [businessId]);

  function markDone() {
    try {
      localStorage.setItem(storageKey(businessId), "done");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-guide-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-panel-dark">
        <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Finance guide · {step + 1}/{STEPS.length}
              </p>
              <h2
                id="finance-guide-title"
                className="text-base font-bold text-ink dark:text-cream-100"
              >
                {current.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={markDone}
            aria-label="Close guide"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-muted dark:text-cream-400">
            {current.body}
          </p>
          {current.href && current.cta ? (
            <Link
              href={current.href}
              onClick={markDone}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-200"
            >
              {current.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 px-5 py-3 dark:border-hairline-dark">
          <button
            type="button"
            onClick={markDone}
            className="text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400"
          >
            Skip guide
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
              >
                Back
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                onClick={markDone}
                className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
