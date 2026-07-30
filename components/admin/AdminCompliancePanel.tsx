"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Download,
  LayoutGrid,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  AdminComplianceCalendar,
} from "@/components/admin/AdminComplianceCalendar";
import {
  AdminComplianceDetailModal,
} from "@/components/admin/AdminComplianceDetailModal";
import {
  ADMIN_COMPLIANCE_CATEGORIES,
  categoryLabel,
  type AdminComplianceCategory,
  type AdminComplianceRow,
  type ComplianceInAppAlert,
} from "@/lib/admin/task-compliance-schemas";
import {
  AMIR_MISSING_DOCS_PROMPT,
  AMIR_RENEWALS_PROMPT,
  CATEGORY_STYLE,
  COMPLIANCE_PRESETS,
  type ComplianceFilter,
} from "@/lib/admin/compliance-shared";
import { cn } from "@/lib/utils/cn";

interface AdminCompliancePanelProps {
  initialItems: AdminComplianceRow[];
  initialAlerts: ComplianceInAppAlert[];
}

type ViewMode = "list" | "calendar";
type SortKey = "expiry" | "title" | "category";

function urgencyAccent(
  urgency: AdminComplianceRow["urgency"],
  category: AdminComplianceCategory,
): string {
  if (urgency === "overdue") return "border-l-status-danger";
  if (urgency === "soon") return "border-l-status-warning";
  return CATEGORY_STYLE[category].accent;
}

function fmtExpiry(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRenewed(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-MY", {
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

function isDueThisMonth(iso: string): boolean {
  const now = new Date();
  const d = new Date(iso + "T00:00:00");
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function AdminCompliancePanel({
  initialItems,
  initialAlerts,
}: AdminCompliancePanelProps) {
  const [items, setItems] = useState(initialItems);
  const [alerts, setAlerts] = useState(initialAlerts);
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
  const [selected, setSelected] = useState<AdminComplianceRow | null>(null);
  const [filter, setFilter] = useState<ComplianceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const stats = useMemo(() => {
    const overdue = items.filter((i) => i.urgency === "overdue").length;
    const soon = items.filter((i) => i.urgency === "soon").length;
    const ok = items.filter((i) => i.urgency === "ok").length;
    return { total: items.length, overdue, soon, ok };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (filter === "overdue") {
      list = list.filter((i) => i.urgency === "overdue");
    } else if (filter === "due_month") {
      list = list.filter((i) => isDueThisMonth(i.expires_on));
    } else if (filter !== "all") {
      list = list.filter((i) => i.category === filter);
    }

    return [...list].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      if (sortKey === "category") {
        return categoryLabel(a.category).localeCompare(categoryLabel(b.category));
      }
      return (
        new Date(a.expires_on).getTime() - new Date(b.expires_on).getTime()
      );
    });
  }, [filter, items, sortKey]);

  const applyPreset = useCallback(
    (preset: (typeof COMPLIANCE_PRESETS)[number]) => {
      setTitle(preset.title);
      setCategory(preset.category);
      setAuthority(preset.authority);
      setShowForm(true);
      setFormError(null);
    },
    [],
  );

  const patchItem = useCallback(
    async (
      id: string,
      body: Record<string, unknown>,
    ): Promise<AdminComplianceRow> => {
      const res = await fetch(`/api/admin/compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: AdminComplianceRow;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "Update failed.");
      }
      return json.data;
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
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [authority, category, expiresOn, notes, referenceNumber, title],
  );

  const dismissAlert = useCallback(async (alertId: string) => {
    const res = await fetch("/api/admin/compliance/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_id: alertId }),
    });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  }, []);

  const openItem = useCallback((item: AdminComplianceRow) => {
    setSelected(item);
    setFormError(null);
  }, []);

  const handleSaveDetail = useCallback(
    async (
      patch: Partial<AdminComplianceRow> & {
        next_expires_on?: string;
        status?: "renewed";
      },
    ) => {
      if (!selected) return;
      setBusyId(selected.id);
      try {
        const updated = await patchItem(selected.id, patch);
        setItems((prev) =>
          prev
            .map((i) => (i.id === selected.id ? updated : i))
            .sort(
              (a, b) =>
                new Date(a.expires_on).getTime() -
                new Date(b.expires_on).getTime(),
            ),
        );
        setSelected(updated);
      } catch (e) {
        throw e;
      } finally {
        setBusyId(null);
      }
    },
    [patchItem, selected],
  );

  const handleDeleteDetail = useCallback(async () => {
    if (!selected || !window.confirm("Remove this licence from your tracker?")) {
      return;
    }
    setBusyId(selected.id);
    try {
      const res = await fetch(`/api/admin/compliance/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed.");
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setSelected(null);
    } finally {
      setBusyId(null);
    }
  }, [selected]);

  const handleCreateTask = useCallback(async () => {
    if (!selected) return;
    setBusyId(selected.id);
    try {
      const res = await fetch(
        `/api/admin/compliance/${selected.id}/create-task`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        ok: boolean;
        task_url?: string;
        message?: string;
        duplicate?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Could not create task.");
      }
      return {
        task_url: json.task_url,
        message: json.message,
        duplicate: json.duplicate,
      };
    } finally {
      setBusyId(null);
    }
  }, [selected]);

  const amirHref = `/admin/assistant?q=${encodeURIComponent(AMIR_RENEWALS_PROMPT)}`;
  const amirMissingDocsHref = `/admin/assistant?q=${encodeURIComponent(AMIR_MISSING_DOCS_PROMPT)}`;
  const missingDocCount = items.filter((i) => !i.admin_file_id).length;

  return (
    <div className="space-y-5">
      <section
        aria-label="Compliance summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Tracked
          </p>
          <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4 shadow-card dark:bg-status-danger/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-status-danger">
            Overdue
          </p>
          <p className="mt-1 text-2xl font-bold text-status-danger">
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-xl border border-status-warning/35 bg-status-warning/10 p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C5C0A] dark:text-[#F5C97A]">
            Due in 30 days
          </p>
          <p className="mt-1 text-2xl font-bold text-[#8C5C0A] dark:text-[#F5C97A]">
            {stats.soon}
          </p>
        </div>
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-wider text-status-success">
            All good
          </p>
          <p className="mt-1 text-2xl font-bold text-status-success">
            {stats.ok}
          </p>
        </div>
      </section>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm shadow-card dark:border-brand-800 dark:bg-brand-950/30"
            >
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-200" />
              <p className="flex-1 font-medium text-ink dark:text-cream-100">
                {alert.message}
              </p>
              <button
                type="button"
                onClick={() => void dismissAlert(alert.id)}
                className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-cream-200 dark:hover:bg-hairline-dark/60"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {(stats.overdue > 0 || stats.soon > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm shadow-card",
            stats.overdue > 0
              ? "border-status-danger/30 bg-gradient-to-r from-status-danger/10 to-status-danger/5"
              : "border-status-warning/35 bg-gradient-to-r from-status-warning/15 to-status-warning/5",
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                stats.overdue > 0 ? "text-status-danger" : "text-[#8C5C0A] dark:text-[#F5C97A]",
              )}
              strokeWidth={2}
            />
            <p
              className={cn(
                "font-medium",
                stats.overdue > 0
                  ? "text-status-danger"
                  : "text-[#8C5C0A] dark:text-[#F5C97A]",
              )}
            >
              {stats.overdue > 0
                ? `${stats.overdue} licence${stats.overdue === 1 ? "" : "s"} overdue. `
                : ""}
              {stats.soon > 0
                ? `${stats.soon} expiring within 30 days — plan renewals early.`
                : ""}
            </p>
          </div>
          <Link
            href={amirHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm hover:bg-white dark:bg-panel-dark dark:text-brand-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask Amir
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ComplianceFilter)}
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          aria-label="Filter licences"
        >
          <option value="all">All licences</option>
          <option value="overdue">Overdue only</option>
          <option value="due_month">Due this month</option>
          {ADMIN_COMPLIANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          aria-label="Sort licences"
        >
          <option value="expiry">Sort by expiry</option>
          <option value="title">Sort by name</option>
          <option value="category">Sort by category</option>
        </select>
        <div className="flex rounded-lg border border-cream-300 dark:border-hairline-dark">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold",
              viewMode === "list"
                ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                : "text-ink-muted dark:text-cream-400",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={cn(
              "inline-flex items-center gap-1 border-l border-cream-300 px-3 py-2 text-sm font-semibold dark:border-hairline-dark",
              viewMode === "calendar"
                ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
                : "text-ink-muted dark:text-cream-400",
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </button>
        </div>
        <a
          href="/api/admin/compliance/export?format=csv"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400"
        >
          <Download className="h-4 w-4" />
          CSV
        </a>
        <a
          href="/api/admin/compliance/export?format=html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400"
        >
          <Download className="h-4 w-4" />
          PDF / print
        </a>
        <Link
          href={amirHref}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100"
        >
          <Sparkles className="h-4 w-4" />
          Ask Amir
        </Link>
        {missingDocCount > 0 ? (
          <Link
            href={amirMissingDocsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm font-semibold text-[#8C5C0A] dark:text-[#F5C97A]"
          >
            Missing docs ({missingDocCount})
          </Link>
        ) : null}
      </div>

      <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 dark:border-brand-800 dark:from-brand-950/40 dark:to-panel-dark">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-cream-100">
              <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              Quick add a renewal
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Tap a preset or add your own licence — we&apos;ll track the expiry
              for you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {showForm ? "Close form" : "Custom entry"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMPLIANCE_PRESETS.map((preset) => {
            const style = CATEGORY_STYLE[preset.category];
            const Icon = style.icon;
            return (
              <button
                key={preset.title}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors",
                  style.chip,
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {preset.authority}
              </button>
            );
          })}
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-4 rounded-xl border border-brand-200 bg-white p-5 shadow-card dark:border-brand-800 dark:bg-panel-dark"
        >
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            New licence or permit
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor="compliance-title"
              className="text-xs font-semibold text-ink dark:text-cream-100"
            >
              Name <span className="text-status-danger">*</span>
            </label>
            <input
              id="compliance-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="compliance-category"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Category
              </label>
              <select
                id="compliance-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as AdminComplianceCategory)
                }
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              >
                {ADMIN_COMPLIANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compliance-expires"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Expiry date <span className="text-status-danger">*</span>
              </label>
              <input
                id="compliance-expires"
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                required
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="compliance-authority"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Authority
              </label>
              <input
                id="compliance-authority"
                type="text"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compliance-ref"
                className="text-xs font-semibold text-ink dark:text-cream-100"
              >
                Reference no.
              </label>
              <input
                id="compliance-ref"
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="compliance-notes"
              className="text-xs font-semibold text-ink dark:text-cream-100"
            >
              Notes
            </label>
            <textarea
              id="compliance-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100"
            />
          </div>
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save licence
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 py-16 text-center dark:border-hairline-dark dark:bg-panel-dark/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/40">
            <ShieldCheck
              className="h-7 w-7 text-brand-700 dark:text-brand-200"
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              No licences tracked yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-ink-muted dark:text-cream-400">
              Start with a common renewal — we&apos;ll remind you in-app before
              it expires.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {COMPLIANCE_PRESETS.slice(0, 4).map((preset) => {
              const style = CATEGORY_STYLE[preset.category];
              const Icon = style.icon;
              return (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm",
                    style.chip,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  Add {preset.authority}
                </button>
              );
            })}
          </div>
        </div>
      ) : viewMode === "calendar" ? (
        <AdminComplianceCalendar items={filteredItems} onSelect={openItem} />
      ) : filteredItems.length === 0 ? (
        <p className="rounded-xl border border-cream-200 bg-white px-4 py-8 text-center text-sm text-ink-muted dark:border-hairline-dark dark:bg-panel-dark">
          No licences match this filter.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filteredItems.map((item) => {
            const busy = busyId === item.id;
            const days = item.days_until_expiry ?? 0;
            const style = CATEGORY_STYLE[item.category];
            const Icon = style.icon;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openItem(item)}
                  className={cn(
                    "w-full overflow-hidden rounded-2xl border border-cream-200/90 bg-white text-left shadow-card transition-shadow dark:border-hairline-dark dark:bg-panel-dark",
                    "border-l-4",
                    urgencyAccent(item.urgency, item.category),
                    busy && "opacity-60",
                    !busy && "hover:shadow-elevated",
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          item.urgency === "overdue"
                            ? "bg-status-danger/10 text-status-danger"
                            : item.urgency === "soon"
                              ? "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]"
                              : "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-ink dark:text-cream-100">
                          {item.title}
                        </p>
                        <span className="mt-1.5 inline-block rounded-md bg-cream-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                          {categoryLabel(item.category)}
                        </span>
                        <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
                          {item.authority ? `${item.authority} · ` : ""}
                          Expires {fmtExpiry(item.expires_on)}
                        </p>
                        {item.last_renewed_at ? (
                          <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-400">
                            Last renewed {fmtRenewed(item.last_renewed_at)}
                          </p>
                        ) : null}
                        {item.admin_file_name ? (
                          <p className="mt-1 truncate text-[11px] text-brand-700 dark:text-brand-200">
                            📎 {item.admin_file_name}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] font-medium text-[#8C5C0A] dark:text-[#F5C97A]">
                            No certificate uploaded
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold",
                          item.urgency === "overdue" &&
                            "bg-status-danger/10 text-status-danger",
                          item.urgency === "soon" &&
                            "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
                          item.urgency === "ok" &&
                            "bg-status-success/10 text-status-success",
                        )}
                      >
                        {daysLabel(days)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <AdminComplianceDetailModal
          item={selected}
          busy={busyId === selected.id}
          onClose={() => setSelected(null)}
          onSave={handleSaveDetail}
          onDelete={handleDeleteDetail}
          onCreateTask={handleCreateTask}
        />
      ) : null}
    </div>
  );
}
