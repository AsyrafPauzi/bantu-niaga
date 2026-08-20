"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  Send,
  Ban,
  Sparkles,
} from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import type { FinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import { cn } from "@/lib/utils/cn";
import { useTranslations } from "next-intl";
import {
  buildInvoiceShareMessage,
  emailShareUrl,
  formatMyr,
  invoiceShareUrl,
  whatsAppShareUrl,
  type FinanceInvoiceRow,
  type FinanceInvoiceStatus,
} from "@/lib/finance/schemas";

interface FinanceInvoicePanelProps {
  initialInvoices: FinanceInvoiceRow[];
  summary: FinanceInvoicesSummary;
  idcompany: string;
  businessName: string;
  appUrl: string;
  documentKind?: "invoice" | "quote" | "all";
  statusFilter?: FinanceInvoiceStatus | "all";
  customerIdFilter?: string;
  customerFilterName?: string | null;
  page?: number;
  pageSize?: number;
  total?: number;
  shellMode?: boolean;
}

function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

function fmtShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

function invoiceStatusClasses(
  status: FinanceInvoiceStatus,
  dueDate: string | null,
  isQuote: boolean,
): string {
  if (isQuote) {
    return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100";
  }
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  if (status === "draft") {
    return "border-cream-300 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300";
  }
  if (dueDate && dueDate < malaysiaTodayYmd()) {
    return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100";
  }
  if (status === "sent") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
  }
  return "border-cream-300 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300";
}

function invoiceStatusLabel(
  status: FinanceInvoiceStatus,
  isQuote: boolean,
  dueDate: string | null,
): string {
  if (isQuote) return status === "draft" ? "Quote draft" : "Quote sent";
  if (status === "sent" && dueDate && dueDate < malaysiaTodayYmd()) {
    return "Overdue";
  }
  if (status === "sent") return "Awaiting pay";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildFilterHref(
  opts: {
    kind?: "invoice" | "quote" | "all";
    status?: FinanceInvoiceStatus | "all";
    customerId?: string;
  },
  customerIdFilter?: string,
): string {
  const params = new URLSearchParams();
  if (opts.kind && opts.kind !== "all") params.set("kind", opts.kind);
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  const customerId = opts.customerId ?? customerIdFilter;
  if (customerId) params.set("customer_id", customerId);
  const qs = params.toString();
  return qs ? `/finance/invoices?${qs}` : "/finance/invoices";
}

export function FinanceInvoicePanel({
  initialInvoices,
  summary,
  idcompany,
  businessName,
  appUrl,
  documentKind = "all",
  statusFilter = "all",
  customerIdFilter,
  customerFilterName,
  page = 1,
  pageSize = 10,
  total = initialInvoices.length,
  shellMode = false,
}: FinanceInvoicePanelProps) {
  const tFinance = useTranslations("finance");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [query, setQuery] = useState(
    () => searchParams.get("q")?.trim() ?? "",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [mailtoFallback, setMailtoFallback] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<FinanceInvoiceRow | null>(
    null,
  );
  const [convertDueDate, setConvertDueDate] = useState("");

  useEffect(() => {
    setInvoices(initialInvoices);
  }, [initialInvoices]);

  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const hay = [
        inv.number,
        inv.customer_name,
        inv.title,
        inv.customer_email,
        inv.customer_phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, query]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const withCustomerFilter = useCallback(
    (opts: {
      kind?: "invoice" | "quote" | "all";
      status?: FinanceInvoiceStatus | "all";
      customerId?: string;
    }) => buildFilterHref(opts, customerIdFilter),
    [customerIdFilter],
  );

  const patchInvoice = useCallback(
    async (id: string, status: FinanceInvoiceStatus) => {
      if (
        status === "void" &&
        !window.confirm("Void this document? This cannot be undone.")
      ) {
        return;
      }
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: FinanceInvoiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Update failed.");
        }
        if (status === "void") {
          setInvoices((prev) => prev.filter((i) => i.id !== id));
        } else {
          setInvoices((prev) =>
            prev.map((i) => (i.id === id ? json.data! : i)),
          );
        }
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const convertQuote = useCallback(
    async (id: string, dueDate?: string | null) => {
      setBusyId(id);
      try {
        const res = await fetch(
          `/api/finance/invoices/${id}/convert-to-invoice`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ due_date: dueDate ?? null }),
          },
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: FinanceInvoiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Conversion failed.");
        }
        setConvertTarget(null);
        router.push(`/finance/invoices/${json.data.id}/edit?converted=1`);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const openConvert = useCallback((inv: FinanceInvoiceRow) => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setConvertDueDate(inv.due_date ?? d.toISOString().slice(0, 10));
    setConvertTarget(inv);
  }, []);

  const shareLinks = useCallback(
    (inv: FinanceInvoiceRow) => {
      const url = invoiceShareUrl(appUrl, idcompany, inv.share_hash);
      const message = buildInvoiceShareMessage(
        businessName,
        inv.number,
        Number(inv.total_myr),
        url,
      );
      return { url, whatsapp: whatsAppShareUrl(message), message };
    },
    [appUrl, businessName, idcompany],
  );

  const sendInvoiceEmail = useCallback(
    async (inv: FinanceInvoiceRow) => {
      if (!inv.customer_email?.trim()) {
        setEmailError(`Add an email for ${inv.customer_name} before sending.`);
        setMailtoFallback(null);
        return;
      }
      setEmailError(null);
      setMailtoFallback(null);
      setBusyId(inv.id);
      try {
        const res = await fetch(`/api/finance/invoices/${inv.id}/send`, {
          method: "POST",
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: { code?: string; message?: string };
        };
        if (!res.ok || !json.ok) {
          if (
            res.status === 412 ||
            json.error?.code === "email_channel_not_configured"
          ) {
            const links = shareLinks(inv);
            setMailtoFallback(
              emailShareUrl(
                `Invoice ${inv.number} from ${businessName}`,
                links.message,
                inv.customer_email ?? undefined,
              ),
            );
            setEmailError(
              `Couldn’t send from the app — open your email client for ${inv.number}.`,
            );
            return;
          }
          throw new Error(json.error?.message ?? "Could not send email.");
        }
        refresh();
      } catch (e) {
        setEmailError(e instanceof Error ? e.message : "Could not send email.");
      } finally {
        setBusyId(null);
      }
    },
    [businessName, refresh, shareLinks],
  );

  const heroHeadline =
    summary.outstanding_myr > 0
      ? `${formatMyr(summary.outstanding_myr)} awaiting payment`
      : summary.invoice_count === 0
        ? "Send your first invoice"
        : "All caught up on payments";

  const heroSub =
    summary.overdue_count > 0
      ? `${summary.overdue_count} overdue — chase them on WhatsApp.`
      : summary.draft_count > 0
        ? `${summary.draft_count} draft${summary.draft_count === 1 ? "" : "s"} ready to send.`
        : "Share a link; customers pay via DuitNow on the invoice page.";

  const filterChips: Array<{
    label: string;
    href: string;
    active: boolean;
    count?: number;
  }> = [
    {
      label: "All",
      href: withCustomerFilter({}),
      active: documentKind === "all" && statusFilter === "all",
    },
    {
      label: "Invoices",
      href: withCustomerFilter({ kind: "invoice" }),
      active: documentKind === "invoice" && statusFilter === "all",
      count: summary.invoice_count,
    },
    {
      label: "Quotes",
      href: withCustomerFilter({ kind: "quote" }),
      active: documentKind === "quote" && statusFilter === "all",
      count: summary.quote_count,
    },
    {
      label: "Draft",
      href: withCustomerFilter({ kind: "invoice", status: "draft" }),
      active: statusFilter === "draft",
      count: summary.draft_count,
    },
    {
      label: "Awaiting pay",
      href: withCustomerFilter({ kind: "invoice", status: "sent" }),
      active: statusFilter === "sent" && documentKind !== "quote",
      count: summary.sent_count,
    },
    {
      label: "Overdue",
      href: withCustomerFilter({ kind: "invoice", status: "sent" }),
      active: false,
      count: summary.overdue_count,
    },
    {
      label: "Paid",
      href: withCustomerFilter({ kind: "invoice", status: "paid" }),
      active: statusFilter === "paid",
      count: summary.paid_count,
    },
  ];

  const heroEmoji =
    summary.outstanding_myr > 0
      ? "💸"
      : summary.invoice_count === 0
        ? "✨"
        : "🎉";

  const nudges = [
    summary.overdue_count > 0
      ? {
          label: `${summary.overdue_count} overdue — chase on WhatsApp`,
          href: withCustomerFilter({ kind: "invoice", status: "sent" }),
          tone: "danger" as const,
        }
      : null,
    summary.draft_count > 0
      ? {
          label: `${summary.draft_count} draft${summary.draft_count === 1 ? "" : "s"} ready to send`,
          href: withCustomerFilter({ kind: "invoice", status: "draft" }),
          tone: "neutral" as const,
        }
      : null,
    summary.quote_count > 0 && documentKind !== "invoice"
      ? {
          label: `${summary.quote_count} open quote${summary.quote_count === 1 ? "" : "s"}`,
          href: withCustomerFilter({ kind: "quote" }),
          tone: "accent" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    tone: "danger" | "neutral" | "accent";
  }>;

  const actionBtn =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60";
  const actionBtnOutline =
    "border border-cream-300 bg-white text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

  return (
    <div className="space-y-4">
      {shellMode ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={
              customerIdFilter
                ? `/finance/invoices/new?customer_id=${encodeURIComponent(customerIdFilter)}`
                : "/finance/invoices/new"
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            {tFinance("newInvoice")}
          </Link>
          <Link
            href="/finance/invoices/new?kind=quote"
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-panel-dark dark:text-violet-100"
          >
            <MessageSquareQuote className="h-4 w-4" />
            {tFinance("newQuote")}
          </Link>
        </div>
      ) : (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 shadow-card",
          summary.outstanding_myr > 0
            ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:border-amber-900/40 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-rose-950/20"
            : summary.invoice_count === 0
              ? "border-sky-200/80 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50 dark:border-sky-900/40 dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-violet-950/20"
              : "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-sky-950/20",
        )}
      >
        <div className="pointer-events-none absolute -right-2 -top-2 text-6xl opacity-25">
          {heroEmoji}
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-400">
              Invoices &amp; quotes
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
              {heroHeadline}
            </h2>
            <p className="mt-1 max-w-lg text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={
                customerIdFilter
                  ? `/finance/invoices/new?customer_id=${encodeURIComponent(customerIdFilter)}`
                  : "/finance/invoices/new"
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              {tFinance("newInvoice")}
            </Link>
            <Link
              href="/finance/invoices/new?kind=quote"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white/90 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-panel-dark/90 dark:text-violet-100 dark:hover:bg-violet-950/40"
            >
              <MessageSquareQuote className="h-4 w-4" />
              {tFinance("newQuote")}
            </Link>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-amber-200/60 bg-white/70 p-3 dark:border-amber-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Outstanding
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-amber-800 dark:text-amber-100">
              {formatMyr(summary.outstanding_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Awaiting pay
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.sent_count}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200/60 bg-white/70 p-3 dark:border-sky-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Drafts
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.draft_count}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/60 bg-white/70 p-3 dark:border-violet-900/40 dark:bg-panel-dark/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Open quotes
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink dark:text-cream-100">
              {summary.quote_count}
            </p>
          </div>
        </div>
      </section>
      )}

      {customerIdFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2.5 dark:border-sky-900 dark:bg-sky-950/30">
          <p className="text-sm text-ink dark:text-cream-100">
            Showing invoices & quotes for{" "}
            <span className="font-semibold">
              {customerFilterName ?? "this customer"}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={`/finance/invoices/new?customer_id=${encodeURIComponent(customerIdFilter)}`}
              className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
            >
              + {tFinance("newInvoice")}
            </Link>
            <Link
              href="/finance/invoices"
              className="text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-200"
            >
              Clear filter
            </Link>
          </div>
        </div>
      ) : null}

      {nudges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {nudges.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                item.tone === "danger"
                  ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                  : item.tone === "accent"
                    ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
                    : "border-cream-300 bg-white text-ink-muted hover:border-sky-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-300",
              )}
            >
              <Sparkles className="h-3 w-3" />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <ModuleListPanel>
        <ModuleListPanelFilters>
          <nav
            aria-label="Filter invoices"
            className="flex flex-wrap gap-1.5"
          >
            {filterChips.map((chip) => (
              <ModuleListFilterChipLink
                key={chip.label}
                href={chip.href}
                active={chip.active}
                accent="sky"
                label={chip.label}
                count={chip.count}
              />
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
              <Search
                className="h-4 w-4 shrink-0 text-ink-muted"
                strokeWidth={2}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search invoice #, customer, title…"
                className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
              />
            </div>
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
              >
                Clear
              </button>
            ) : null}
          </div>
        </ModuleListPanelFilters>

        {emailError ? (
          <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {emailError}
            </span>
            {mailtoFallback ? (
              <a href={mailtoFallback} className="font-semibold underline">
                Open email app
              </a>
            ) : null}
          </div>
        ) : null}

        {filteredInvoices.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="text-4xl">
              {documentKind === "quote" ? "📝" : "🧾"}
            </div>
            <p className="mt-3 text-sm font-medium text-ink dark:text-cream-100">
              {query.trim()
                ? "No invoices match your search"
                : documentKind === "quote"
                  ? "No quotes here yet"
                  : statusFilter !== "all"
                    ? "Nothing in this filter"
                    : "No invoices yet"}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              {documentKind === "quote"
                ? "Send a quote first — convert to invoice when they say yes."
                : tFinance("emptyHint")}
            </p>
            <Link
              href={
                documentKind === "quote"
                  ? "/finance/invoices/new?kind=quote"
                  : "/finance/invoices/new"
              }
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              {documentKind === "quote"
                ? tFinance("newQuote")
                : tFinance("newInvoice")}
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {filteredInvoices.map((inv) => {
            const busy = busyId === inv.id;
            const links = shareLinks(inv);
            const total = Number(inv.total_myr);
            const isQuote = inv.document_kind === "quote";
            const statusLabel = invoiceStatusLabel(
              inv.status,
              isQuote,
              inv.due_date,
            );
            const isOverdue =
              !isQuote &&
              inv.status === "sent" &&
              inv.due_date &&
              inv.due_date < malaysiaTodayYmd();

            return (
              <li
                key={inv.id}
                className="p-4 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/80"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
                      isQuote
                        ? "bg-gradient-to-br from-violet-400 to-purple-500 text-white"
                        : "bg-gradient-to-br from-sky-400 to-blue-500 text-white",
                    )}
                  >
                    {isQuote ? (
                      <MessageSquareQuote className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                            {inv.customer_name}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              invoiceStatusClasses(
                                inv.status,
                                inv.due_date,
                                isQuote,
                              ),
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                          <span className="font-medium text-ink/80 dark:text-cream-200">
                            {inv.number}
                          </span>
                          {inv.invoice_date
                            ? ` · ${fmtShortDate(inv.invoice_date)}`
                            : ""}
                          {inv.due_date
                            ? ` · due ${fmtShortDate(inv.due_date)}`
                            : ""}
                          {inv.title ? ` · ${inv.title}` : ""}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-lg font-bold tabular-nums",
                          isOverdue
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-ink dark:text-cream-100",
                        )}
                      >
                        {formatMyr(total)}
                      </p>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Link
                        href={`/finance/invoices/${inv.id}/edit`}
                        className={cn(actionBtn, actionBtnOutline)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>

                      {isQuote ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openConvert(inv)}
                          className={cn(
                            actionBtn,
                            "bg-brand-500 text-white hover:bg-brand-600",
                          )}
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          Convert
                        </button>
                      ) : null}

                      {inv.status === "draft" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchInvoice(inv.id, "sent")}
                          className={cn(
                            actionBtn,
                            "border border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
                          )}
                        >
                          <Send className="h-3 w-3" />
                          Mark sent
                        </button>
                      ) : null}

                      {inv.status === "sent" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchInvoice(inv.id, "paid")}
                          className={cn(
                            actionBtn,
                            "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
                          )}
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Mark paid
                        </button>
                      ) : null}

                      {inv.status !== "void" && inv.status !== "paid" ? (
                        <>
                          <a
                            href={links.whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              actionBtn,
                              "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
                            )}
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void sendInvoiceEmail(inv)}
                            className={cn(actionBtn, actionBtnOutline)}
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            Email
                          </button>
                          <a
                            href={links.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(actionBtn, actionBtnOutline)}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Pay link
                          </a>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void patchInvoice(inv.id, "void")}
                            className={cn(
                              actionBtn,
                              "text-ink-muted hover:text-status-danger dark:text-cream-400",
                            )}
                          >
                            <Ban className="h-3 w-3" />
                            Void
                          </button>
                        </>
                      ) : null}
                    </div>
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
            basePath="/finance/invoices"
            searchParams={{
              ...(documentKind !== "all" ? { kind: documentKind } : {}),
              ...(statusFilter !== "all" ? { status: statusFilter } : {}),
              ...(customerIdFilter ? { customer_id: customerIdFilter } : {}),
            }}
          />
          </>
        )}
      </ModuleListPanel>

      {convertTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-panel-dark">
            <h3 className="text-base font-bold text-ink dark:text-cream-100">
              Convert quote to invoice
            </h3>
            <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
              {convertTarget.customer_name} ·{" "}
              {formatMyr(Number(convertTarget.total_myr))}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Creates a draft invoice with the same line items. The quote stays
              on file.
            </p>
            <label className="mt-4 block text-xs font-medium text-ink-muted">
              Due date
              <input
                type="date"
                value={convertDueDate}
                onChange={(e) => setConvertDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvertTarget(null)}
                className="rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold dark:border-hairline-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === convertTarget.id}
                onClick={() =>
                  void convertQuote(convertTarget.id, convertDueDate || null)
                }
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {busyId === convertTarget.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Create invoice
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
