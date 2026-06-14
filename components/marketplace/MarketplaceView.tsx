"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Database,
  FileCheck,
  Loader2,
  MessageCircle,
  Music,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Star,
  UserPlus,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  CADENCE_LABEL,
  PILLAR_LABEL,
  formatMyr,
  type AddonPillar,
  type CatalogEntry,
} from "@/lib/marketplace/types";

interface Props {
  initial: CatalogEntry[];
  canEdit: boolean;
  tier: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "user-plus": UserPlus,
  database: Database,
  zap: Zap,
  music: Music,
  "file-check": FileCheck,
  sparkles: Sparkles,
  "shopping-bag": ShoppingBag,
};

type FilterKey = "all" | "active" | AddonPillar;

/**
 * Tab order requested by the product owner — pillars first (in the same
 * order they appear in the sidebar's information architecture), followed
 * by AI Agents, then the global aggregates "All add-ons" and "Active".
 *
 * The catch-all `cross` pillar is intentionally absent: every add-on
 * shipped in the catalog now lives under a concrete pillar.
 */
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "hr", label: "HR" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "marketing", label: "Marketing" },
  { key: "sales", label: "Sales" },
  { key: "ai", label: "AI agents" },
  { key: "all", label: "All add-ons" },
  { key: "active", label: "Active" },
];

export function MarketplaceView({ initial, canEdit, tier }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<CatalogEntry[]>(initial);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [toast, setToast] = useState<
    { kind: "ok" | "err"; msg: string } | null
  >(null);
  const [confirm, setConfirm] = useState<{
    slug: string;
    name: string;
    next_charge_at: string | null;
  } | null>(null);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: entries.length,
      active: 0,
      marketing: 0,
      operations: 0,
      finance: 0,
      ai: 0,
      admin: 0,
      sales: 0,
      hr: 0,
      cross: 0,
    };
    for (const e of entries) {
      c[e.addon.pillar] = (c[e.addon.pillar] ?? 0) + 1;
      if (e.activation && e.activation.status === "active") c.active += 1;
    }
    return c;
  }, [entries]);

  const featured = entries.find((e) => e.addon.is_featured) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (filter === "all") return true;
        if (filter === "active") return e.activation?.status === "active";
        return e.addon.pillar === filter;
      })
      .filter((e) => {
        if (!q) return true;
        return (
          e.addon.name.toLowerCase().includes(q) ||
          e.addon.short_desc.toLowerCase().includes(q) ||
          e.addon.slug.includes(q)
        );
      });
  }, [entries, filter, query]);

  const active = entries.filter((e) => e.activation?.status === "active");
  const nextCharge = active
    .map((e) => e.activation?.next_charge_at)
    .filter((d): d is string => !!d)
    .sort()[0];

  async function refresh() {
    const res = await fetch("/api/marketplace", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setEntries(json.entries as CatalogEntry[]);
  }

  async function activate(slug: string) {
    if (!canEdit) {
      setToast({ kind: "err", msg: "Only the owner can activate add-ons." });
      return;
    }
    setBusySlug(slug);
    try {
      const res = await fetch("/api/marketplace/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({
          kind: "err",
          msg: json?.message ?? json?.error ?? "Could not activate.",
        });
        return;
      }
      setToast({ kind: "ok", msg: "Add-on activated." });
      await refresh();
      router.refresh();
    } finally {
      setBusySlug(null);
    }
  }

  async function deactivate(slug: string) {
    if (!canEdit) return;
    setBusySlug(slug);
    try {
      const res = await fetch("/api/marketplace/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({
          kind: "err",
          msg: json?.message ?? json?.error ?? "Could not deactivate.",
        });
        return;
      }
      setToast({ kind: "ok", msg: "Add-on scheduled to cancel." });
      setConfirm(null);
      await refresh();
      router.refresh();
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast ? (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            toast.kind === "ok"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-danger/30 bg-status-danger/10 text-status-danger"
          }`}
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <p className="text-sm font-medium">{toast.msg}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Search + tabs row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-cream-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search WhatsApp, storage, …"
            className="w-full rounded-xl border border-cream-300 bg-white py-2 pl-9 pr-3 text-sm shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>
        <div className="text-right text-xs text-ink-muted dark:text-cream-400">
          <span className="font-semibold text-ink dark:text-cream-100">
            {active.length}
          </span>{" "}
          active ·{" "}
          {nextCharge
            ? `Next charge ${formatDate(nextCharge)}`
            : "No upcoming charges"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = counts[f.key];
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-brand-500 text-white shadow-card"
                  : "border border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? "bg-brand-700/40 text-white"
                    : f.key === "active"
                      ? "bg-status-success/20 text-status-success"
                      : "bg-cream-200 text-ink-muted dark:bg-hairline-dark/60 dark:text-cream-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Featured banner */}
      {featured && filter === "all" && !query ? (
        <FeaturedBanner
          entry={featured}
          onActivate={() => activate(featured.addon.slug)}
          onDeactivate={() =>
            setConfirm({
              slug: featured.addon.slug,
              name: featured.addon.name,
              next_charge_at: featured.activation?.next_charge_at ?? null,
            })
          }
          busy={busySlug === featured.addon.slug}
          canEdit={canEdit}
        />
      ) : null}

      {/* Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            {filter === "all" ? "All add-ons" : `${labelFor(filter)} add-ons`}
            <span className="ml-2 text-sm font-normal text-ink-muted dark:text-cream-400">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Sort: Popular ▾
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cream-300 bg-white/60 p-12 text-center dark:border-hairline-dark dark:bg-panel-dark/60">
            <p className="text-sm font-medium text-ink dark:text-cream-100">
              {query
                ? "No add-ons match your search."
                : filter === "active"
                  ? "You have no active add-ons yet."
                  : `No ${labelFor(filter)} add-ons available yet — more coming soon.`}
            </p>
            <button
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="mt-2 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Show all add-ons
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <AddonCard
                key={e.addon.id}
                entry={e}
                canEdit={canEdit}
                busy={busySlug === e.addon.slug}
                tier={tier}
                onActivate={() => activate(e.addon.slug)}
                onDeactivate={() =>
                  setConfirm({
                    slug: e.addon.slug,
                    name: e.addon.name,
                    next_charge_at: e.activation?.next_charge_at ?? null,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Active summary */}
      {active.length > 0 ? (
        <section className="rounded-2xl border border-cream-300 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink dark:text-cream-100">
              Active add-ons ({active.length})
            </h2>
            <span className="text-xs text-ink-muted dark:text-cream-400">
              {nextCharge
                ? `Next charge · ${formatDate(nextCharge)}`
                : "No upcoming charges"}
            </span>
          </header>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {active.map((e) => {
              const Icon = ICON_MAP[e.addon.icon] ?? Settings2;
              return (
                <li
                  key={e.addon.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-status-success/10 text-status-success">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink dark:text-cream-100">
                        {e.addon.name}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {e.activation?.cancel_at
                          ? `Cancels on ${formatDate(e.activation.cancel_at)}`
                          : e.activation?.next_charge_at
                            ? `Active since ${formatDate(e.activation.activated_at)} · renews ${formatDate(e.activation.next_charge_at)}`
                            : `Included in your ${tierLabel(tier)} plan`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.activation?.cancel_at ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-status-warning/15 px-2.5 py-1 text-xs font-semibold text-status-warning">
                        <Clock3 className="h-3 w-3" /> Pending cancel
                      </span>
                    ) : null}
                    {canEdit && !e.activation?.cancel_at ? (
                      <button
                        onClick={() =>
                          setConfirm({
                            slug: e.addon.slug,
                            name: e.addon.name,
                            next_charge_at: e.activation?.next_charge_at ?? null,
                          })
                        }
                        className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Deactivate confirm modal */}
      {confirm ? (
        <Modal onClose={() => setConfirm(null)}>
          <h3 className="text-lg font-semibold text-ink dark:text-cream-100">
            Deactivate {confirm.name}?
          </h3>
          <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
            {confirm.next_charge_at
              ? `It stays usable until ${formatDate(confirm.next_charge_at)}. You won't be charged again.`
              : "It will be cancelled immediately. You can re-activate any time."}
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirm(null)}
              className="rounded-lg border border-cream-300 px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400 dark:hover:text-cream-100"
            >
              Keep active
            </button>
            <button
              onClick={() => deactivate(confirm.slug)}
              disabled={busySlug === confirm.slug}
              className="inline-flex items-center gap-2 rounded-lg bg-status-danger px-3 py-2 text-sm font-semibold text-white hover:bg-status-danger/90 disabled:opacity-60"
            >
              {busySlug === confirm.slug ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Deactivate
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AddonCard({
  entry,
  canEdit,
  busy,
  tier,
  onActivate,
  onDeactivate,
}: {
  entry: CatalogEntry;
  canEdit: boolean;
  busy: boolean;
  tier: string;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { addon, activation } = entry;
  const Icon = ICON_MAP[addon.icon] ?? Settings2;
  const isActive = activation?.status === "active";
  const isCancelling = !!activation?.cancel_at;
  const isIncluded = addon.included_in_tier.includes(tier);
  const priceLabel = isIncluded ? "Included" : formatMyr(addon.price_cents);
  const cadenceLabel = isIncluded
    ? `in your ${tierLabel(tier)} plan`
    : addon.cadence === "monthly"
      ? "/month"
      : addon.cadence === "yearly"
        ? "/year"
        : "one-time";

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-card transition-colors dark:bg-panel-dark ${
        isActive
          ? "border-2 border-status-success"
          : "border border-cream-300 dark:border-hairline-dark"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-xl ${
            isActive
              ? "bg-status-success/10 text-status-success"
              : "bg-brand-50 text-brand-700 dark:bg-brand-700/15 dark:text-brand-200"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-success">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
            {isCancelling ? "Cancels soon" : "Active"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            {PILLAR_LABEL[addon.pillar]}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-ink dark:text-cream-100">
          {addon.name}
        </h3>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          {addon.short_desc}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between pt-2">
        <div>
          <p
            className={`text-lg font-bold ${
              isIncluded
                ? "text-status-success"
                : "text-ink dark:text-cream-100"
            }`}
          >
            {priceLabel}
          </p>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            {cadenceLabel}
          </p>
        </div>
        {isActive ? (
          <button
            onClick={onDeactivate}
            disabled={!canEdit || busy || isCancelling}
            className="rounded-lg border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            {isCancelling ? "Cancelling…" : "Manage"}
          </button>
        ) : isIncluded ? (
          <button
            onClick={onActivate}
            disabled={!canEdit || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </button>
        ) : (
          <button
            onClick={onActivate}
            disabled={!canEdit || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Activate
          </button>
        )}
      </div>
    </article>
  );
}

function FeaturedBanner({
  entry,
  busy,
  canEdit,
  onActivate,
  onDeactivate,
}: {
  entry: CatalogEntry;
  busy: boolean;
  canEdit: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const Icon = ICON_MAP[entry.addon.icon] ?? Sparkles;
  const isActive = entry.activation?.status === "active";

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-6 text-white shadow-card sm:px-8 sm:py-8">
      <div className="relative grid items-center gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
            Featured
          </span>
          <h2 className="max-w-xl text-2xl font-bold leading-tight sm:text-[26px]">
            {entry.addon.name}
          </h2>
          <p className="max-w-lg text-sm text-brand-100">
            {entry.addon.short_desc}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isActive ? (
              <button
                onClick={onDeactivate}
                disabled={!canEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                Active · Manage
              </button>
            ) : (
              <button
                onClick={onActivate}
                disabled={!canEdit || busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-accent-600 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Activate · {formatMyr(entry.addon.price_cents)}
                {CADENCE_LABEL[entry.addon.cadence]}
              </button>
            )}
            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-brand-100 hover:text-white"
            >
              Read setup guide →
            </a>
          </div>
        </div>
        <div className="hidden flex-col items-end gap-3 sm:flex">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-white/10 backdrop-blur">
            <Icon className="h-12 w-12 text-white" strokeWidth={1.5} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <Star className="h-3 w-3" /> Most installed
          </span>
        </div>
      </div>
    </section>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-panel-dark"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function labelFor(key: FilterKey): string {
  if (key === "all" || key === "active") return key === "all" ? "All" : "Active";
  return PILLAR_LABEL[key];
}

function tierLabel(t: string): string {
  return t.slice(0, 1).toUpperCase() + t.slice(1);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
