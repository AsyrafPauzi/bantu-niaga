"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const STORAGE_PREFIX = "bn-hr-guide-v1:";

const STEPS = [
  {
    title: "Welcome to People & Leave",
    body: "Manage your team, track leave, run payroll, and handle HR paperwork — without spreadsheets.",
    href: null as string | null,
    cta: null as string | null,
    icon: Users,
  },
  {
    title: "2 · Add your employees",
    body: "Start with just name, job title, and start date. Payroll details and documents can be added later from their profile.",
    href: "/hr/employees/new",
    cta: "Add employee",
    icon: UserPlus,
  },
  {
    title: "3 · Set leave types & holidays",
    body: "Configure annual leave, MC, and emergency leave days. Import public holidays so staff leave requests are accurate.",
    href: "/hr/settings/leave-types",
    cta: "Set up leave",
    icon: CalendarDays,
  },
  {
    title: "4 · Approve leave requests",
    body: "When staff apply for leave, you will see pending requests here. Approve or reject with a single tap.",
    href: "/hr/leave",
    cta: "View leave",
    icon: ClipboardCheck,
  },
  {
    title: "5 · Ask your HR assistant",
    body: "The HR AI assistant can draft warning letters, check leave balances, and answer HR policy questions.",
    href: "/hr?assistant=open",
    cta: "Open assistant",
    icon: Sparkles,
  },
] as const;

function storageKey(businessId: string) {
  return `${STORAGE_PREFIX}${businessId}`;
}

export function HrGuideJourney({ businessId }: { businessId: string }) {
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
    <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 shadow-card dark:border-teal-900/40 dark:from-teal-950/30 dark:via-panel-dark dark:to-cyan-950/20">
      <button
        type="button"
        onClick={markDone}
        className="absolute right-3 top-3 rounded-lg p-1 text-ink-muted hover:bg-white/60 dark:text-cream-400"
        aria-label="Dismiss guide"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
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
