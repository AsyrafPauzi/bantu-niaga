"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import { apiErrorMessage } from "@/lib/api/client-error";
import type {
  FinanceCustomerWithStats,
  FinanceCustomersSummary,
} from "@/lib/finance/customers";
import { formatMyr } from "@/lib/finance/schemas";
import { cn } from "@/lib/utils/cn";

interface FinanceCustomerPanelProps {
  initialCustomers: FinanceCustomerWithStats[];
  summary: FinanceCustomersSummary;
  page: number;
  pageSize: number;
  total: number;
  searchQuery: string;
}

const AVATAR_PALETTES = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-fuchsia-500",
] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function fmtShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function waUrl(phoneE164: string): string {
  return `https://wa.me/${phoneE164.replace(/[^\d]/g, "")}`;
}

export function FinanceCustomerPanel({
  initialCustomers,
  summary,
  page,
  pageSize,
  total,
  searchQuery,
}: FinanceCustomerPanelProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState(searchQuery);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const onSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const q = search.trim();
      if (q) params.set("q", q);
      const qs = params.toString();
      router.push(qs ? `/finance/customers?${qs}` : "/finance/customers");
    },
    [router, search],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/finance/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone: phone || null,
            email: email || null,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(apiErrorMessage(json, "Could not save customer."));
        }
        setName("");
        setPhone("");
        setEmail("");
        setShowForm(false);
        router.push("/finance/customers");
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [email, name, phone, refresh],
  );

  const deleteCustomer = useCallback(
    async (id: string, customerName: string) => {
      if (
        !window.confirm(
          `Remove ${customerName}? Their saved details will be hidden — existing invoices stay as they are.`,
        )
      ) {
        return;
      }
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/customers/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-card dark:border-amber-900/40 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-rose-950/20">
        <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-20">
          👥
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
          Your customers
        </h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Save billing contacts once — pick them when you create invoices or quotes.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-amber-200/60 bg-white/70 p-3 dark:border-amber-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Saved
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200/60 bg-white/70 p-3 dark:border-sky-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Reachable
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.with_contact}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Billed before
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.active_billers}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Unpaid
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-rose-700 dark:text-rose-200">
              {formatMyr(summary.outstanding_myr)}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={onSearch}
          className="relative min-w-0 flex-1 sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-cream-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-full rounded-full border border-cream-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </form>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            showForm
              ? "border border-cream-300 bg-white text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              : "bg-brand-500 text-white hover:bg-brand-600",
          )}
        >
          {showForm ? (
            <>
              <ChevronDown className="h-4 w-4 rotate-180" />
              Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add customer
            </>
          )}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
        >
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            New billing contact
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name or company *"
              required
              className={inputCx}
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone / WhatsApp"
              className={inputCx}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputCx}
            />
          </div>
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-300 bg-white/50 py-14 text-center dark:border-hairline-dark dark:bg-panel-dark/40">
          <div className="text-4xl">🧾</div>
          <p className="mt-3 text-sm font-medium text-ink dark:text-cream-100">
            {searchQuery
              ? "No customers match your search."
              : "No customers yet"}
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {searchQuery
              ? "Try a different name, phone, or email."
              : "Add someone you bill often — reuse them on every invoice."}
          </p>
          {!searchQuery ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Add first customer
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {customers.map((c) => {
            const busy = busyId === c.id;
            const hasBilling =
              c.stats.invoice_count > 0 || c.stats.quote_count > 0;
            return (
              <li
                key={c.id}
                className="p-4 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/80"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm",
                      avatarPalette(c.name),
                    )}
                  >
                    {initialsOf(c.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                          {c.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {c.phone_e164 ? (
                            <a
                              href={waUrl(c.phone_e164)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                            >
                              <MessageCircle className="h-3 w-3" />
                              {c.phone_e164}
                            </a>
                          ) : null}
                          {c.email ? (
                            <a
                              href={`mailto:${encodeURIComponent(c.email)}`}
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                            >
                              <Mail className="h-3 w-3" />
                              <span className="max-w-[10rem] truncate">{c.email}</span>
                            </a>
                          ) : null}
                          {!c.phone_e164 && !c.email ? (
                            <span className="text-[11px] text-ink-muted dark:text-cream-400">
                              No contact yet
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                          href={`/finance/invoices/new?customer_id=${encodeURIComponent(c.id)}`}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                        >
                          <FileText className="h-3 w-3" />
                          Invoice
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deleteCustomer(c.id, c.name)}
                          className="inline-flex items-center justify-center rounded-full border border-cream-300 p-1.5 text-ink-muted hover:border-rose-200 hover:text-status-danger disabled:opacity-50 dark:border-hairline-dark dark:text-cream-400"
                          aria-label={`Remove ${c.name}`}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {hasBilling ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted dark:text-cream-400">
                        {c.stats.invoice_count > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {c.stats.invoice_count} invoice
                            {c.stats.invoice_count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {c.stats.quote_count > 0 ? (
                          <span>
                            {c.stats.quote_count} quote
                            {c.stats.quote_count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {c.stats.unpaid_myr > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-300">
                            <Wallet className="h-3 w-3" />
                            {formatMyr(c.stats.unpaid_myr)} unpaid
                          </span>
                        ) : null}
                        {c.stats.last_invoice_date ? (
                          <span>Last billed {fmtShortDate(c.stats.last_invoice_date)}</span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
                        Not billed yet — create their first invoice.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          </ul>
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/finance/customers"
            searchParams={{ q: searchQuery || undefined }}
            className="border-t border-cream-200 dark:border-hairline-dark"
          />
        </div>
      )}
    </div>
  );
}

const inputCx =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";
