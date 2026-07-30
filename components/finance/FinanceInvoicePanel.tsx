"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Ban,
} from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { ListPagination } from "@/components/ui/list-pagination";
import type { FinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import { cn } from "@/lib/utils/cn";
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
  page?: number;
  pageSize?: number;
  total?: number;
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

function invoiceStatusTone(
  status: FinanceInvoiceStatus,
  dueDate: string | null,
  isQuote: boolean,
): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (isQuote) return "accent";
  if (status === "paid") return "success";
  if (status === "draft") return "neutral";
  if (dueDate && dueDate < malaysiaTodayYmd()) return "danger";
  if (status === "sent") return "warning";
  return "neutral";
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

function buildFilterHref(opts: {
  kind?: "invoice" | "quote" | "all";
  status?: FinanceInvoiceStatus | "all";
}): string {
  const params = new URLSearchParams();
  if (opts.kind && opts.kind !== "all") params.set("kind", opts.kind);
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
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
  page = 1,
  pageSize = 10,
  total = initialInvoices.length,
}: FinanceInvoicePanelProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [mailtoFallback, setMailtoFallback] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<FinanceInvoiceRow | null>(
    null,
  );
  const [convertDueDate, setConvertDueDate] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

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
      href: buildFilterHref({}),
      active: documentKind === "all" && statusFilter === "all",
    },
    {
      label: "Invoices",
      href: buildFilterHref({ kind: "invoice" }),
      active: documentKind === "invoice" && statusFilter === "all",
      count: summary.invoice_count,
    },
    {
      label: "Quotes",
      href: buildFilterHref({ kind: "quote" }),
      active: documentKind === "quote" && statusFilter === "all",
      count: summary.quote_count,
    },
    {
      label: "Draft",
      href: buildFilterHref({ kind: "invoice", status: "draft" }),
      active: statusFilter === "draft",
      count: summary.draft_count,
    },
    {
      label: "Awaiting pay",
      href: buildFilterHref({ kind: "invoice", status: "sent" }),
      active: statusFilter === "sent" && documentKind !== "quote",
      count: summary.sent_count,
    },
    {
      label: "Overdue",
      href: "/finance/invoices?status=sent&kind=invoice",
      active: false,
      count: summary.overdue_count,
    },
    {
      label: "Paid",
      href: buildFilterHref({ kind: "invoice", status: "paid" }),
      active: statusFilter === "paid",
      count: summary.paid_count,
    },
  ];

  return (
    <div className="space-y-5">
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 shadow-card sm:p-6",
          summary.outstanding_myr > 0
            ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-brand-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-panel-dark dark:to-brand-950/20"
            : "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-brand-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-panel-dark dark:to-brand-950/20",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              {heroHeadline}
            </h2>
            <p className="mt-1 max-w-lg text-sm text-ink-muted dark:text-cream-400">
              {heroSub}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/invoices/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
            <Link
              href="/finance/invoices/new?kind=quote"
              className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <FileText className="h-4 w-4" />
              New quote
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="text-xs text-ink-muted dark:text-cream-400">Outstanding</p>
            <p className="text-lg font-bold text-ink dark:text-cream-100">
              {formatMyr(summary.outstanding_myr)}
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="text-xs text-ink-muted dark:text-cream-400">Awaiting pay</p>
            <p className="text-lg font-bold text-ink dark:text-cream-100">
              {summary.sent_count}
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="text-xs text-ink-muted dark:text-cream-400">Drafts</p>
            <p className="text-lg font-bold text-ink dark:text-cream-100">
              {summary.draft_count}
            </p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-3 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
            <p className="text-xs text-ink-muted dark:text-cream-400">Open quotes</p>
            <p className="text-lg font-bold text-ink dark:text-cream-100">
              {summary.quote_count}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <Link
            key={chip.label}
            href={chip.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              chip.active
                ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100"
                : "border-cream-300 bg-white text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {chip.label}
            {chip.count !== undefined && chip.count > 0 ? (
              <span className="tabular-nums opacity-80">{chip.count}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {emailError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {emailError}
          </span>
          {mailtoFallback ? (
            <a
              href={mailtoFallback}
              className="font-semibold underline"
            >
              Open email app
            </a>
          ) : null}
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-300 py-14 text-center dark:border-hairline-dark">
          <p className="text-sm font-medium text-ink dark:text-cream-100">
            {documentKind === "quote"
              ? "No quotes here yet"
              : statusFilter !== "all"
                ? "Nothing in this filter"
                : "No invoices yet"}
          </p>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            {documentKind === "quote"
              ? "Send a quote first — convert to invoice when they say yes."
              : "Create an invoice, share on WhatsApp, mark paid when money arrives."}
          </p>
          <Link
            href={
              documentKind === "quote"
                ? "/finance/invoices/new?kind=quote"
                : "/finance/invoices/new"
            }
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-200"
          >
            <Plus className="h-4 w-4" />
            {documentKind === "quote" ? "New quote" : "New invoice"}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {invoices.map((inv) => {
            const busy = busyId === inv.id;
            const links = shareLinks(inv);
            const total = Number(inv.total_myr);
            const isQuote = inv.document_kind === "quote";
            const tone = invoiceStatusTone(inv.status, inv.due_date, isQuote);
            const statusLabel = invoiceStatusLabel(
              inv.status,
              isQuote,
              inv.due_date,
            );

            return (
              <li
                key={inv.id}
                className="p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink dark:text-cream-100">
                        {inv.number}
                      </p>
                      <StatusPill tone={tone}>{statusLabel}</StatusPill>
                    </div>
                    <p className="mt-0.5 text-sm text-ink dark:text-cream-100">
                      {inv.customer_name}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {inv.invoice_date ? fmtShortDate(inv.invoice_date) : "—"}
                      {inv.due_date
                        ? ` · due ${fmtShortDate(inv.due_date)}`
                        : ""}
                      {inv.title ? ` · ${inv.title}` : ""}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(total)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-cream-100 pt-3 dark:border-hairline-dark">
                  <Link
                    href={`/finance/invoices/${inv.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>

                  {isQuote ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openConvert(inv)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      Convert
                    </button>
                  ) : null}

                  {inv.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchInvoice(inv.id, "sent")}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Mark sent
                    </button>
                  ) : null}

                  {inv.status === "sent" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchInvoice(inv.id, "paid")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
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
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void sendInvoiceEmail(inv)}
                        className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        Email
                      </button>
                      <a
                        href={links.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Pay link
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patchInvoice(inv.id, "void")}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-ink-muted hover:text-status-danger dark:text-cream-400"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Void
                      </button>
                    </>
                  ) : null}
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
            }}
          />
        </div>
      )}

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
