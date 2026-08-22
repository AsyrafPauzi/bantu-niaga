"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Mail, MessageCircle } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { buildCtcUrl } from "@/lib/marketing/broadcasts-shared";

interface Recipient {
  id: string;
  customer_id: string;
  channel_address: string;
  rendered_message: string;
  rendered_subject: string | null;
  status: "queued" | "sent" | "failed" | "opened";
  error: string | null;
  sent_at: string | null;
  customer_name?: string;
}

interface Props {
  broadcastId: string;
  channel: "whatsapp_ctc" | "email";
  recipient: Recipient;
}

function statusTone(s: Recipient["status"]) {
  switch (s) {
    case "queued":
      return "neutral" as const;
    case "sent":
      return "success" as const;
    case "failed":
      return "danger" as const;
    case "opened":
      return "brand" as const;
  }
}

/**
 * Compact per-recipient row for the broadcast detail page.
 * Message body is shown once above the list — not repeated here.
 */
export function BroadcastRecipientRow({ broadcastId, channel, recipient }: Props) {
  const [status, setStatus] = useState<Recipient["status"]>(recipient.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onMarkSent() {
    if (busy || status === "sent") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/broadcasts/${broadcastId}/recipients/${recipient.id}/mark-sent`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.message ?? body.error ?? `mark-sent failed (${res.status})`,
        );
      }
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "mark-sent failed");
    } finally {
      setBusy(false);
    }
  }

  const waUrl =
    channel === "whatsapp_ctc"
      ? buildCtcUrl(recipient.channel_address, recipient.rendered_message)
      : null;

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
            {recipient.customer_name ?? recipient.customer_id}
          </p>
          <StatusPill tone={statusTone(status)}>{status}</StatusPill>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted dark:text-cream-400">
          {channel === "whatsapp_ctc" ? (
            <MessageCircle className="mr-1 inline h-3 w-3 text-[#25D366]" strokeWidth={2} />
          ) : (
            <Mail className="mr-1 inline h-3 w-3" strokeWidth={2} />
          )}
          {recipient.channel_address}
        </p>
        {recipient.error ? (
          <p className="mt-1 text-[11px] text-status-danger">{recipient.error}</p>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-status-danger">{error}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {channel === "whatsapp_ctc" ? (
          <>
            <a
              href={waUrl ?? "#"}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#1d8a4b] hover:bg-[#25D366]/20 dark:text-[#25D366]"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={2.25} />
              Open WA
            </a>
            <button
              type="button"
              onClick={onMarkSent}
              disabled={busy || status === "sent"}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} />
              ) : null}
              {status === "sent" ? "Sent" : "Mark sent"}
            </button>
          </>
        ) : (
          <span className="text-[11px] text-ink-muted dark:text-cream-400">
            {recipient.sent_at
              ? new Date(recipient.sent_at).toLocaleString("en-MY", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        )}
      </div>
    </li>
  );
}
