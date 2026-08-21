"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarPlus,
  FolderOpen,
  ListChecks,
  Sparkles,
  X,
} from "lucide-react";

const STORAGE_PREFIX = "bn-admin-guide-v1:";

const STEPS = [
  {
    title: "Welcome to Admin",
    body: "Tasks, licence renewals, and document storage — your daily back-office hub.",
    href: null as string | null,
    cta: null as string | null,
    icon: ListChecks,
  },
  {
    title: "2 · Track your tasks",
    body: "Drag cards across To do → Doing → Done. Attach files from Storage on any task.",
    href: "/admin/tasks",
    cta: "Task board",
    icon: ListChecks,
  },
  {
    title: "3 · Never miss a renewal",
    body: "Log SSM, DBKL, insurance, and permits — Amir flags what's due soon.",
    href: "/admin/compliance",
    cta: "Compliance tracker",
    icon: CalendarPlus,
  },
  {
    title: "4 · Store documents safely",
    body: "Upload receipts, contracts, and HR docs — tagged by category for Finance & Ops.",
    href: "/admin/storage",
    cta: "Open storage",
    icon: FolderOpen,
  },
  {
    title: "5 · Ask Amir",
    body: "Amir reads your tasks, renewals, and storage — and suggests what to tackle next.",
    href: "/admin?amir=open",
    cta: "Chat with Amir",
    icon: Bot,
  },
] as const;

function storageKey(businessId: string) {
  return `${STORAGE_PREFIX}${businessId}`;
}

export function AdminGuideJourney({ businessId }: { businessId: string }) {
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

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-brand-50 p-4 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-brand-700/10 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Admin tour · step {step + 1} of {STEPS.length}
          </p>
        </div>
        <button
          type="button"
          onClick={markDone}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
          aria-label="Dismiss tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink dark:text-cream-100">
            {current.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-300">
            {current.body}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {current.href && current.cta ? (
          <Link
            href={current.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            {current.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={markDone}
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            Got it
          </button>
        )}
        <button
          type="button"
          onClick={markDone}
          className="text-xs font-medium text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-200"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
