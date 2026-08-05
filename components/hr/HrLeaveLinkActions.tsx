"use client";

import { useState } from "react";
import { buildCtcUrl } from "@/lib/marketing/broadcasts-shared";
import { cn } from "@/lib/utils/cn";

interface HrLeaveLinkActionsProps {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  align?: "start" | "end";
}

export function HrLeaveLinkActions({
  employeeId,
  employeeName,
  employeePhone,
  align = "end",
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
  const phoneDigits = employeePhone?.replace(/\D/g, "") ?? "";
  const whatsappHref =
    url && phoneDigits
      ? buildCtcUrl(`+${phoneDigits}`, whatsappText)
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "end" ? "items-end" : "items-start",
      )}
    >
      <button
        type="button"
        onClick={generateLink}
        disabled={busy}
        className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-teal-50 disabled:opacity-60 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950/40"
      >
        {busy ? "Generating…" : "Create leave link"}
      </button>
      {url ? (
        <div
          className={cn(
            "flex flex-wrap gap-2 text-xs",
            align === "end" ? "justify-end" : "justify-start",
          )}
        >
          <button
            type="button"
            onClick={copyLink}
            className="font-semibold text-[#0D9488] hover:underline dark:text-teal-400"
          >
            Copy link
          </button>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#0D9488] hover:underline dark:text-teal-400"
            >
              Send WhatsApp
            </a>
          ) : (
            <span className="text-ink-muted dark:text-cream-500">
              Add a phone number on the profile to send WhatsApp
            </span>
          )}
        </div>
      ) : null}
      {message ? (
        <p
          className={cn(
            "max-w-md text-[11px] text-ink-muted dark:text-cream-400",
            align === "end" ? "text-right" : "text-left",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
