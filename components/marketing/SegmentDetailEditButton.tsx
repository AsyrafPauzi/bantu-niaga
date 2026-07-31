"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { SegmentRuleBuilder } from "@/components/marketing/SegmentRuleBuilder";
import type { SegmentRules } from "@/lib/marketing/segments-rules";
import type { SegmentRow } from "@/lib/marketing/segments";

interface SegmentDetailEditButtonProps {
  segment: SegmentRow;
  defaultOpen?: boolean;
}

export function SegmentDetailEditButton({
  segment,
  defaultOpen = false,
}: SegmentDetailEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
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
              : `Save failed (${res.status})`,
        );
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        `Remove segment "${segment.name}"?\n\nIt will be hidden from broadcasts and segment lists.`,
      )
    ) {
      return;
    }
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
              : `Delete failed (${res.status})`,
        );
      }
      router.push("/marketing/segments");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
          Edit rules
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white/80 px-3 py-2.5 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:bg-panel-dark/80 dark:text-rose-300"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          Remove
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-xl dark:border-violet-900/40 dark:bg-panel-dark">
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
                <X className="h-4 w-4" strokeWidth={2} />
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
                <p className="mt-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
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
