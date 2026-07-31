"use client";

import {
  buildMarketingEmailHtml,
  plainTextToHtmlBody,
} from "@/lib/marketing/email-broadcast-template";

interface EmailBroadcastPreviewProps {
  fromLabel: string;
  toName: string;
  toEmail?: string | null;
  subject: string;
  bodyText: string;
  businessName?: string;
  className?: string;
}

export function EmailBroadcastPreview({
  fromLabel,
  toName,
  toEmail,
  subject,
  bodyText,
  businessName,
  className,
}: EmailBroadcastPreviewProps) {
  const previewHtml = buildMarketingEmailHtml({
    subject: subject || "(No subject)",
    bodyText: bodyText || "Your message will appear here.",
    businessName,
  });

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="border-b border-cream-200 bg-cream-50/80 px-4 py-3 dark:border-hairline-dark dark:bg-hairline-dark/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Inbox preview
          </p>
          <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
            <span className="font-semibold text-ink dark:text-cream-200">From:</span>{" "}
            {fromLabel}
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            <span className="font-semibold text-ink dark:text-cream-200">To:</span>{" "}
            {toName}
            {toEmail ? ` <${toEmail}>` : ""}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink dark:text-cream-100">
            {subject || "(No subject yet)"}
          </p>
        </div>
        <div
          className="max-h-[420px] overflow-y-auto bg-[#f4f0eb] p-3"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
      <p className="mt-2 text-[11px] text-ink-muted dark:text-cream-400">
        Recipients also get a plain-text version. Placeholders like{" "}
        <code className="font-mono">{"{first_name}"}</code> are replaced per
        customer when sent.
      </p>
    </div>
  );
}

/** Lightweight body-only preview for step 3 side panel (no full HTML doc). */
export function EmailBodyPreviewPane({
  bodyText,
  className,
}: {
  bodyText: string;
  className?: string;
}) {
  const html = plainTextToHtmlBody(bodyText || "Start typing your message…");

  return (
    <div
      className={`rounded-xl border border-cream-200 bg-white p-4 text-sm dark:border-hairline-dark dark:bg-panel-dark ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
