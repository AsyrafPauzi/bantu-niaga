"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle } from "lucide-react";
import {
  emailShareUrl,
  whatsAppShareUrl,
} from "@/lib/finance/schemas";

/**
 * Core coupon share — copy link + WhatsApp / email.
 * Public /c/[code] landing page can ship later; URL shape is locked.
 */
export function CouponShareLink({
  code,
  discountLabel,
}: {
  code: string;
  discountLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  function origin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://bantuniaga.app";
  }

  const url = `${origin()}/c/${encodeURIComponent(code)}`;
  const message =
    `Use coupon code *${code}*` +
    (discountLabel ? ` — ${discountLabel}` : "") +
    `\n${url}`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onCopy()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
        title={url}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-status-success" strokeWidth={2.5} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
        <span>{copied ? "Copied!" : "Copy link"}</span>
        <ExternalLink className="h-3 w-3 text-ink-muted" strokeWidth={2} />
      </button>
      <a
        href={whatsAppShareUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </a>
      <a
        href={emailShareUrl(`Coupon ${code}`, message)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </a>
    </div>
  );
}
