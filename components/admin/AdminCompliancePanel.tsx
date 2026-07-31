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
  Paperclip,
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
  AdminCatalogEmpty,
  AdminCatalogList,
  AdminCatalogThumb,
} from "@/components/admin/AdminCatalogUi";
import {
  QuickActionBar,
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { useQuickCreate } from "@/hooks/use-quick-create";
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
  const { open: showForm, toggle: toggleForm, close: closeForm, openPanel } =
    useQuickCreate();
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
      openPanel();
      setFormError(null);
    },
    [openPanel],
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
        closeForm();
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
            List
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

      <QuickActionBar
        open={showForm}
        onToggle={() => {
          setFormError(null);
          toggleForm();
        }}
        actionLabel="Custom entry"
      />

      <QuickCreatePanel
        open={showForm}
        onSubmit={onCreate}
        title="New licence or permit"
        subtitle="We'll remind you before expiry."
        icon={ShieldCheck}
        accent="amber"
      >
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
          <QuickCreateActions
            submitLabel="Save licence"
            loading={creating}
            onCancel={closeForm}
          />
      </QuickCreatePanel>

      {items.length === 0 ? (
        <AdminCatalogEmpty
          icon={ShieldCheck}
          title="No licences tracked yet"
          hint="Start with a common renewal — we'll remind you in-app before it expires."
          action={
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
          }
        />
      ) : viewMode === "calendar" ? (
        <AdminComplianceCalendar items={filteredItems} onSelect={openItem} />
      ) : filteredItems.length === 0 ? (
        <p className="rounded-xl border border-cream-200 bg-white px-4 py-8 text-center text-sm text-ink-muted dark:border-hairline-dark dark:bg-panel-dark">
          No licences match this filter.
        </p>
      ) : (
        <AdminCatalogList title="Renewal tracker" total={filteredItems.length}>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {filteredItems.map((item) => {
              const busy = busyId === item.id;
              const days = item.days_until_expiry ?? 0;
              const style = CATEGORY_STYLE[item.category];
              const Icon = style.icon;
              const tone =
                item.urgency === "overdue"
                  ? "rose"
                  : item.urgency === "soon"
                    ? "amber"
                    : "emerald";

              return (
                <li
                  key={item.id}
                  className={cn(
                    "group transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60",
                    item.urgency === "overdue" &&
                      "bg-rose-50/30 dark:bg-rose-950/10",
                    busy && "opacity-60",
                  )}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openItem(item)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4"
                  >
                    <AdminCatalogThumb icon={Icon} tone={tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink dark:text-cream-100">
                          {item.title}
                        </p>
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                          {categoryLabel(item.category)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                        {item.authority ? `${item.authority} · ` : ""}
                        Expires {fmtExpiry(item.expires_on)}
                      </p>
                      {item.last_renewed_at ? (
                        <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                          Last renewed {fmtRenewed(item.last_renewed_at)}
                        </p>
                      ) : null}
                      {item.admin_file_name ? (
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-brand-700 dark:text-brand-200">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          {item.admin_file_name}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
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
                          "bg-status-warning/15 text-amber-900 dark:text-amber-100",
                        item.urgency === "ok" &&
                          "bg-status-success/10 text-status-success",
                      )}
                    >
                      {daysLabel(days)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </AdminCatalogList>
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
