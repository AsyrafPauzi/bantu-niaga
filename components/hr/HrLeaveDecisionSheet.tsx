"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import {
  buildLeaveDecisionMessages,
  waMeUrl,
  type LeaveDecisionStatus,
} from "@/lib/hr/leave-status-messages";
import { cn } from "@/lib/utils/cn";

export function HrLeaveDecisionSheet({
  open,
  onClose,
  status,
  employeeName,
  leaveTypeLabel,
  startDate,
  endDate,
  reason,
  phoneE164,
  preferredLocale = "en",
}: {
  open: boolean;
  onClose: () => void;
  status: LeaveDecisionStatus;
  employeeName: string;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  phoneE164: string | null;
  preferredLocale?: "en" | "ms";
}) {
  const [copied, setCopied] = useState<"en" | "ms" | null>(null);
  if (!open) return null;

  const messages = buildLeaveDecisionMessages({
    status,
    employeeName,
    leaveTypeLabel,
    startDate,
    endDate,
    reason,
  });
  const primary = preferredLocale === "ms" ? messages.ms : messages.en;

  async function copy(lang: "en" | "ms") {
    const text = lang === "en" ? messages.en : messages.ms;
    await navigator.clipboard.writeText(text);
    setCopied(lang);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-5 shadow-xl dark:border-hairline-dark dark:bg-panel-dark"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
              Notify on WhatsApp
            </h2>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              Copy or open WhatsApp — nothing is sent automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 rounded-lg border border-cream-200 bg-cream-50 p-3 text-sm text-ink dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100">
          {primary}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy("en")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            {copied === "en" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy EN
          </button>
          <button
            type="button"
            onClick={() => void copy("ms")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            {copied === "ms" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy MS
          </button>
          {phoneE164 ? (
            <a
              href={waMeUrl(phoneE164, primary)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open WhatsApp
            </a>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink-subtle dark:border-hairline-dark",
              )}
              title="Add phone on employee profile"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Add phone first
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
