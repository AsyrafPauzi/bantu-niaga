"use client";

import { useState } from "react";

interface HrLeaveLinkActionsProps {
  employeeId: string;
  employeeName: string;
}

export function HrLeaveLinkActions({
  employeeId,
  employeeName,
}: HrLeaveLinkActionsProps) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function generateLink() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/hr/leave-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? "Could not create link.");
        return;
      }
      setUrl(json.url);
      setMessage("Expires in 24 hours. Staff name is locked.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    setMessage("Link copied. Expires in 24 hours.");
  }

  const whatsappText = url
    ? `Hi ${employeeName}, please apply leave using this private link. It expires in 24 hours: ${url}`
    : "";
  const whatsappHref = url
    ? `https://wa.me/?text=${encodeURIComponent(whatsappText)}`
    : "#";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={generateLink}
        disabled={busy}
        className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100 dark:hover:text-brand-200"
      >
        {busy ? "Generating..." : "Generate leave link"}
      </button>
      {url ? (
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={copyLink}
            className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Copy link
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Send WhatsApp
          </a>
        </div>
      ) : null}
      {message ? (
        <p className="max-w-48 text-right text-[11px] text-ink-muted dark:text-cream-400">
          {message}
        </p>
      ) : null}
    </div>
  );
}
