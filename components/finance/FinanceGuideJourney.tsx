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
    title: "2 · Log money in & out",
    body: "Expenses for daily spending. Income for capital, loans, or cash sales — not just invoices.",
    href: "/finance/expenses",
    cta: "Log expense",
    icon: Receipt,
  },
  {
    title: "3 · Send an invoice",
    body: "Bill customers with a share link. They can view and pay via DuitNow when you enable it on the invoice.",
    href: "/finance/invoices/new",
    cta: "New invoice",
    icon: FileText,
  },
  {
    title: "4 · Check reports",
    body: "Ledger, P&L statement, and analytics — filter by today up to 30 days.",
    href: "/finance/reports",
    cta: "View reports",
    icon: Wallet,
  },
  {
    title: "5 · Ask Fayza",
    body: "Fayza reads your real numbers — and can log expenses, create invoices, chase payments, and more.",
    href: "/finance?fayza=open",
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
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-card dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-panel-dark dark:to-teal-950/20">
      <button
        type="button"
        onClick={markDone}
        className="absolute right-3 top-3 rounded-lg p-1 text-ink-muted hover:bg-white/60 dark:text-cream-400"
        aria-label="Dismiss guide"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Quick tour · {step + 1}/{STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
            {current.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-300">
            {current.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {current.href && current.cta ? (
              <Link
                href={current.href}
                onClick={markDone}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                {current.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg border border-cream-300 px-3.5 py-2 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={markDone}
                className="rounded-lg border border-cream-300 px-3.5 py-2 text-sm font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
              >
                Got it
              </button>
            )}
            <button
              type="button"
              onClick={markDone}
              className="text-xs font-medium text-ink-muted hover:underline dark:text-cream-400"
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
