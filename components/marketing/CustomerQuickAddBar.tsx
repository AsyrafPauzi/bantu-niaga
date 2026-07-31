"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { MergePromptBanner } from "@/components/marketing/MergePromptBanner";
import { cn } from "@/lib/utils/cn";

interface PromptState {
  existingCustomerId: string;
  existingName: string;
  pendingName: string;
  pendingPhone: string;
}

export function CustomerQuickAddBar({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  async function submit(force: boolean) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: phone.trim() || undefined,
          source: "manual",
          force_create: force,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        action?: string;
        customer_id?: string;
        existing_customer_id?: string;
        existing_name?: string | null;
        message?: string;
        error?: string;
      } | null;

      if (!res.ok) {
        setError(body?.message ?? body?.error ?? "Could not add customer.");
        return;
      }

      if (body?.action === "prompt" && body.existing_customer_id) {
        setPrompt({
          existingCustomerId: body.existing_customer_id,
          existingName: body.existing_name ?? "(unknown)",
          pendingName: trimmedName,
          pendingPhone: phone.trim(),
        });
        return;
      }

      setPrompt(null);
      setName("");
      setPhone("");
      setOpen(false);
      if (body?.customer_id) {
        router.push(`/marketing/customers/${body.customer_id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge() {
    if (!prompt) return;
    router.push(`/marketing/customers/${prompt.existingCustomerId}`);
  }

  async function handleKeepSeparate() {
    if (!prompt) return;
    setName(prompt.pendingName);
    setPhone(prompt.pendingPhone);
    await submit(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-3 text-sm font-semibold text-violet-800 transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-200 dark:hover:bg-violet-950/40",
          className,
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Quick add customer
      </button>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20",
        className,
      )}
    >
      {prompt ? (
        <MergePromptBanner
          existingCustomerId={prompt.existingCustomerId}
          existingName={prompt.existingName}
          onMerge={handleMerge}
          onKeepSeparate={() => void handleKeepSeparate()}
          disabled={busy}
        />
      ) : null}

      <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
        <UserPlus className="h-4 w-4" strokeWidth={2} />
        Quick add
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name *"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          autoFocus
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>

      {error ? (
        <p className="text-xs text-status-danger">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setPrompt(null);
          }}
          disabled={busy}
          className="rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save customer
        </button>
      </div>
    </div>
  );
}
