"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import {
  emailShareUrl,
  whatsAppShareUrl,
} from "@/lib/finance/schemas";

/**
 * Core content sharing — copy caption or open WhatsApp / email.
 * Meta one-click publish lives behind the meta-social add-on.
 */
export function ContentSharePanel({
  caption,
  channelLabel,
}: {
  caption: string;
  channelLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = caption.trim() || `(Draft for ${channelLabel})`;
  const wa = whatsAppShareUrl(text);
  const mail = emailShareUrl(`Content draft · ${channelLabel}`, text);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <h3 className="text-sm font-bold text-ink dark:text-cream-100">
        Copy & share
      </h3>
      <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
        Paste the caption when you post on {channelLabel}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyCaption()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-status-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy caption"}
        </button>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        <a
          href={mail}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </a>
      </div>
    </section>
  );
}
