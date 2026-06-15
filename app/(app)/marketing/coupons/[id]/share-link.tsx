"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/**
 * Copy-to-clipboard button that yields the wa.me-friendly public URL
 * the operator can paste into a WhatsApp broadcast or social caption.
 *
 * Public landing-page implementation is deferred — the URL shape is
 * locked here so future-us can build /c/[code] to render an apply
 * splash. Until then, the URL still copies and resolves to the
 * marketing site root.
 */
export function CouponShareLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function origin(): string {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://bantuniaga.app";
  }

  const url = `${origin()}/c/${encodeURIComponent(code)}`;

  async function onClick() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: open the URL in a new tab so the operator can copy
      // from the address bar manually.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
      title={url}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-status-success" strokeWidth={2.5} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
      )}
      <span>{copied ? "Copied!" : "Copy share link"}</span>
      <ExternalLink className="h-3 w-3 text-ink-muted" strokeWidth={2} />
    </button>
  );
}
