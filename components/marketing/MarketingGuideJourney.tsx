"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Gift,
  Send,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";

const STORAGE_PREFIX = "bn-marketing-guide-v1:";

const STEPS = [
  {
    title: "Welcome to Marketing",
    body: "Know your customers, send promos, and bring buyers back — without complicated tools.",
    href: null as string | null,
    cta: null as string | null,
    icon: Users,
  },
  {
    title: "2 · Customers",
    body: "Add or import your list. Tap VIP, Dormant, or At-risk filters to see who needs attention.",
    href: "/marketing/customers",
    cta: "Open customers",
    icon: Users,
  },
  {
    title: "3 · Segments",
    body: "Group customers by spend or tags. Use segments when you send a broadcast.",
    href: "/marketing/segments",
    cta: "Open segments",
    icon: Tag,
  },
  {
    title: "4 · Broadcasts",
    body: "Send WhatsApp or email to a segment. BM and English templates are in the composer.",
    href: "/marketing/broadcasts/new",
    cta: "New broadcast",
    icon: Send,
  },
  {
    title: "5 · Coupons & content",
    body: "Create promo codes and plan TikTok / IG / FB captions in the content calendar.",
    href: "/marketing/content",
    cta: "Open content",
    icon: Calendar,
  },
] as const;

function storageKey(businessId: string) {
  return `${STORAGE_PREFIX}${businessId}`;
}

export function MarketingGuideJourney({ businessId }: { businessId: string }) {
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
    <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
      <button
        type="button"
        onClick={markDone}
        className="absolute right-3 top-3 rounded-lg p-1 text-ink-muted hover:bg-white/60 dark:text-cream-400"
        aria-label="Dismiss guide"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
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
