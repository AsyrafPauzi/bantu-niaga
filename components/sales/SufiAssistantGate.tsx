"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SufiAssistantGate() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-[#E5E0D8] bg-white p-8 text-center dark:border-hairline-dark dark:bg-panel-dark">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF3FE] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Sparkles className="h-7 w-7" strokeWidth={2} />
      </div>
      <h2 className="text-lg font-bold text-ink dark:text-cream-100">
        Meet Sufi — your Sales helper
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-muted dark:text-cream-400">
        Ask about leads, follow-ups, and today&apos;s POS in plain language.
        Sufi plans like sales staff, drafts chase messages, and can update
        leads after you confirm. Adds 100 credits/mo to your shared AI pool.
      </p>
      <Link
        href="/marketplace"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Get Sufi in Marketplace
      </Link>
      <p className="mt-3 text-xs text-ink-subtle dark:text-cream-500">
        Owner can activate from Marketplace → Sales AI (Sufi)
      </p>
    </div>
  );
}
