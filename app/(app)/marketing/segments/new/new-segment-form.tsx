"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SegmentRuleBuilder } from "@/components/marketing/SegmentRuleBuilder";
import type { SegmentRules } from "@/lib/marketing/segments-rules";

export function NewSegmentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rules, setRules] = useState<SegmentRules>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rules }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : typeof body?.error === "string"
              ? body.error
              : `create failed (${res.status})`,
        );
      }
      const newId = body?.data?.id;
      router.push(
        typeof newId === "string"
          ? `/marketing/segments/${newId}`
          : "/marketing/segments",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <SegmentRuleBuilder
        name={name}
        onNameChange={setName}
        rules={rules}
        onRulesChange={setRules}
        editable={!busy}
      />

      {error ? (
        <p className="rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
        <button
          type="button"
          onClick={() => router.push("/marketing/segments")}
          className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save segment"}
        </button>
      </div>
    </form>
  );
}
