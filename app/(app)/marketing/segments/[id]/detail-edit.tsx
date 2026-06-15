"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { SegmentRuleBuilder } from "@/components/marketing/SegmentRuleBuilder";
import type { SegmentRules } from "@/lib/marketing/segments-rules";
import type { SegmentRow } from "@/lib/marketing/segments";

interface Props {
  segment: SegmentRow;
}

/**
 * Edit/delete trigger for custom segments. The page renders this only
 * when segment.kind === 'custom'; the button opens a modal that re-uses
 * the SegmentRuleBuilder.
 */
export function SegmentDetailEditButton({ segment }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(segment.name);
  const [rules, setRules] = useState<SegmentRules>(
    (segment.rules ?? {}) as SegmentRules,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(segment.name);
      setRules((segment.rules ?? {}) as SegmentRules);
      setError(null);
    }
  }, [open, segment]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketing/segments/${segment.id}`, {
        method: "PATCH",
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
              : `save failed (${res.status})`,
        );
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Soft-delete segment "${segment.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketing/segments/${segment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : typeof body?.error === "string"
              ? body.error
              : `delete failed (${res.status})`,
        );
      }
      router.push("/marketing/segments");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-status-danger shadow-card hover:bg-status-danger/5 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          Delete
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
        >
          <Pencil className="h-4 w-4" strokeWidth={2.25} />
          Edit segment
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-cream-200 bg-panel-light shadow-xl dark:border-hairline-dark dark:bg-panel-dark">
            <header className="flex items-center justify-between border-b border-cream-200 px-5 py-3 dark:border-hairline-dark">
              <h2 className="text-base font-semibold text-ink dark:text-cream-100">
                Edit segment
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-cream-100 hover:text-ink dark:hover:bg-hairline-dark dark:hover:text-cream-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </header>
            <form
              onSubmit={onSave}
              className="max-h-[70vh] overflow-y-auto px-5 py-4"
            >
              <SegmentRuleBuilder
                name={name}
                onNameChange={setName}
                rules={rules}
                onRulesChange={setRules}
                editable={!busy}
              />

              {error ? (
                <p className="mt-4 rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700 disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
