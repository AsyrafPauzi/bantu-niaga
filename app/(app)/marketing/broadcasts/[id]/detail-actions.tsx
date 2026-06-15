"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";

interface Props {
  broadcastId: string;
  channel: "whatsapp_ctc" | "email";
}

/**
 * Top-of-detail action bar for a draft broadcast.
 *
 * "Discard" → DELETE /api/marketing/broadcasts/[id], navigates back.
 * "Send"    → POST   /api/marketing/broadcasts/[id]/send, refreshes
 *             the detail in place so the recipient table populates.
 */
export function BroadcastDetailActions({ broadcastId, channel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "discard" | "send">(null);
  const [error, setError] = useState<string | null>(null);

  async function onDiscard() {
    if (busy) return;
    if (!confirm("Discard this draft? This can't be undone.")) return;
    setBusy("discard");
    setError(null);
    try {
      const res = await fetch(`/api/marketing/broadcasts/${broadcastId}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.reason ?? body.message ?? body.error ?? `discard failed (${res.status})`,
        );
      }
      router.push("/marketing/broadcasts");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "discard failed");
      setBusy(null);
    }
  }

  async function onSend() {
    if (busy) return;
    setBusy("send");
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/broadcasts/${broadcastId}/send`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.reason ?? body.message ?? body.error ?? `send failed (${res.status})`,
        );
      }
      router.refresh();
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={onDiscard}
          className="inline-flex items-center gap-2 rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/15 disabled:opacity-50"
        >
          {busy === "discard" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          )}
          Discard
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={onSend}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
        >
          {busy === "send" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.25} />
          )}
          {channel === "whatsapp_ctc" ? "Resolve recipients" : "Send now"}
        </button>
      </div>
      {error ? (
        <p className="rounded-md bg-status-danger/10 px-2 py-1 text-xs text-status-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
