"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ADMIN_COMPLIANCE_CATEGORIES,
  COMPLIANCE_PRESETS,
  categoryLabel,
  type AdminComplianceCategory,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";

interface AdminCompliancePanelProps {
  initialItems: AdminComplianceRow[];
}

function urgencyTone(
  urgency: AdminComplianceRow["urgency"],
): "danger" | "warning" | "success" {
  if (urgency === "overdue") return "danger";
  if (urgency === "soon") return "warning";
  return "success";
}

function fmtExpiry(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function AdminCompliancePanel({
  initialItems,
}: AdminCompliancePanelProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AdminComplianceCategory>("other");
  const [authority, setAuthority] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [nextExpiry, setNextExpiry] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  const applyPreset = useCallback(
    (preset: (typeof COMPLIANCE_PRESETS)[number]) => {
      setTitle(preset.title);
      setCategory(preset.category);
      setAuthority(preset.authority);
      setShowForm(true);
    },
    [],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/admin/compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            category,
            authority: authority || null,
            reference_number: referenceNumber || null,
            expires_on: expiresOn,
            notes: notes || null,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: AdminComplianceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save item.");
        }
        setItems((prev) =>
          [...prev, json.data!].sort(
            (a, b) =>
              new Date(a.expires_on).getTime() -
              new Date(b.expires_on).getTime(),
          ),
        );
        setTitle("");
        setCategory("other");
        setAuthority("");
        setReferenceNumber("");
        setExpiresOn("");
        setNotes("");
        setShowForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      authority,
      category,
      expiresOn,
      notes,
      referenceNumber,
      refresh,
      title,
    ],
  );

  const markRenewed = useCallback(
    async (id: string) => {
      if (!nextExpiry) {
        setFormError("Enter the next expiry date.");
        return;
      }
      setBusyId(id);
      setFormError(null);
      try {
        const res = await fetch(`/api/admin/compliance/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "renewed",
            next_expires_on: nextExpiry,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: AdminComplianceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Renewal failed.");
        }
        setItems((prev) =>
          prev.map((i) => (i.id === id ? json.data! : i)),
        );
        setRenewId(null);
        setNextExpiry("");
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Renewal failed.");
      } finally {
        setBusyId(null);
      }
    },
    [nextExpiry, refresh],
  );

  const removeItem = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/admin/compliance/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setItems((prev) => prev.filter((i) => i.id !== id));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const overdueCount = items.filter((i) => i.urgency === "overdue").length;
  const soonCount = items.filter((i) => i.urgency === "soon").length;

  return (
    <div className="space-y-4">
      {(overdueCount > 0 || soonCount > 0) && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
            overdueCount > 0
              ? "border-status-danger/30 bg-status-danger/5 text-status-danger"
              : "border-status-warning/30 bg-status-warning/5 text-amber-800 dark:text-amber-200",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {overdueCount > 0
              ? `${overdueCount} licence${overdueCount === 1 ? "" : "s"} overdue. `
              : ""}
            {soonCount > 0
              ? `${soonCount} expiring within 30 days.`
              : overdueCount === 0
                ? "All clear for now."
                : ""}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {COMPLIANCE_PRESETS.map((preset) => (
          <button
            key={preset.title}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-ink-muted hover:border-brand-400 hover:text-brand-700 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:text-brand-200"
          >
            + {preset.authority}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Custom entry
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Licence or permit name"
            required
            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AdminComplianceCategory)
              }
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              {ADMIN_COMPLIANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              required
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              placeholder="Authority (e.g. SSM, DBKL)"
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Reference / registration no."
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-12 text-center dark:border-hairline-dark">
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            No licences tracked yet
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Add SSM, DBKL, or any permit so you never miss a renewal.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {items.map((item) => {
            const tone = urgencyTone(item.urgency);
            const busy = busyId === item.id;
            const days = item.days_until_expiry ?? 0;
            return (
              <li key={item.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink dark:text-cream-100">
                        {item.title}
                      </p>
                      <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                        {categoryLabel(item.category)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      {item.authority ? `${item.authority} · ` : ""}
                      Expires {fmtExpiry(item.expires_on)}
                      {item.reference_number
                        ? ` · Ref ${item.reference_number}`
                        : ""}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold",
                      tone === "danger" && "text-status-danger",
                      tone === "warning" && "text-amber-700 dark:text-amber-300",
                      tone === "success" && "text-status-success",
                    )}
                  >
                    {daysLabel(days)}
                  </span>
                </div>

                {renewId === item.id ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3 dark:border-hairline-dark">
                    <label className="text-xs text-ink-muted dark:text-cream-400">
                      Next expiry
                      <input
                        type="date"
                        value={nextExpiry}
                        onChange={(e) => setNextExpiry(e.target.value)}
                        className="mt-1 block rounded-lg border border-cream-300 px-3 py-1.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markRenewed(item.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Confirm renewal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenewId(null);
                        setNextExpiry("");
                      }}
                      className="text-xs text-ink-muted hover:underline dark:text-cream-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-3 border-t border-cream-100 pt-3 dark:border-hairline-dark">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRenewId(item.id);
                        setFormError(null);
                      }}
                      className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                    >
                      Mark renewed
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeItem(item.id)}
                      className="text-xs text-ink-muted hover:text-status-danger dark:text-cream-400"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
