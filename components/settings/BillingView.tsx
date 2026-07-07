"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CreditCard,
  Download,
  Loader2,
  Receipt,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TOPUP_BUNDLES } from "@/lib/settings/schemas";

const INVOICE_PAGE_SIZE = 10;

interface Invoice {
  id: string;
  number: string;
  kind: "subscription" | "topup" | "addon" | "manual";
  period_label: string | null;
  amount_myr: number;
  tax_myr: number;
  status: "paid" | "pending" | "failed" | "refunded";
  paid_at: string | null;
  pdf_url: string | null;
  created_at: string;
}

interface BillingViewProps {
  initialInvoices: Invoice[];
  initialInvoiceTotal: number;
  creditBalance: number;
  monthlyCreditQuota: number;
  nextChargeMyr: number;
  nextRenewalAt: string | null;
  canEdit: boolean;
  billplzBypass: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BillingView({
  initialInvoices,
  initialInvoiceTotal,
  creditBalance,
  monthlyCreditQuota,
  nextChargeMyr,
  nextRenewalAt,
  canEdit,
  billplzBypass,
}: BillingViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(initialInvoiceTotal);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [balance, setBalance] = useState(creditBalance);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showTopup, setShowTopup] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const invoiceTotalPages = Math.max(
    1,
    Math.ceil(invoiceTotal / INVOICE_PAGE_SIZE),
  );

  async function loadInvoicePage(nextPage: number, force = false) {
    if (nextPage < 1) return;
    if (!force && nextPage === invoicePage) return;

    setError(null);
    setLoadingInvoices(true);
    try {
      const res = await fetch(
        `/api/settings/billing/invoices?page=${nextPage}&pageSize=${INVOICE_PAGE_SIZE}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Could not load invoices");
        return;
      }
      const total = json.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE));
      if (nextPage > totalPages) return;

      setInvoices(json.data ?? []);
      setInvoicePage(json.page ?? nextPage);
      setInvoiceTotal(total);
    } catch {
      setError("Could not load invoices");
    } finally {
      setLoadingInvoices(false);
    }
  }

  function bundleLabel(b: keyof typeof TOPUP_BUNDLES) {
    const v = TOPUP_BUNDLES[b];
    return `RM ${v.amount_myr} → ${v.credits} credits`;
  }

  async function downloadInvoice(id: string) {
    setError(null);
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/settings/billing/invoices/${id}/download`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.message ?? "Could not download invoice");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `invoice-${id}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  async function topup(bundle: keyof typeof TOPUP_BUNDLES) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? "Top-up failed");
        return;
      }
      setBalance(json.new_balance);
      setShowTopup(false);
      await loadInvoicePage(1, true);
    });
  }

  const balancePct =
    monthlyCreditQuota > 0
      ? Math.min(100, Math.round((balance / monthlyCreditQuota) * 100))
      : 0;

  return (
    <>
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {billplzBypass ? (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-ink dark:text-cream-100">
          <strong>Development mode:</strong> Billplz is not configured, so
          Fast Credit top-ups are applied immediately without charging a card.
        </div>
      ) : null}

      {/* Next charge banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-900/30">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-white shadow-card">
            <Wallet className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-brand-700/80 dark:text-brand-200/80">
              Next charge
            </p>
            <p className="mt-0.5 text-xl font-bold text-ink dark:text-cream-100">
              RM {nextChargeMyr.toFixed(2)}{" "}
              <span className="text-sm font-medium text-ink-muted dark:text-cream-400">
                · {fmtDate(nextRenewalAt)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Auto-renew via Billplz
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTopup(true)}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            <Zap className="h-4 w-4" strokeWidth={2} />
            Top up credits
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {/* Payment method — Billplz only */}
          <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <CreditCard className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Payment method
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  All payments go through Billplz — FPX, credit card, and debit
                  card.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="grid h-9 w-12 place-items-center rounded-md bg-gradient-to-br from-sky-700 to-sky-500 text-[9px] font-bold tracking-wider text-white">
                BILLPLZ
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
                  Billplz
                  <Badge tone="accent">Default</Badge>
                </p>
                <p className="text-[11px] text-ink-muted dark:text-cream-400">
                  FPX · Credit card · Debit card
                </p>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Receipt className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Invoices
                  </h3>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Tax invoices generated each billing cycle.
                  </p>
                </div>
              </div>
            </div>
            {invoiceTotal === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
                No invoices yet.
              </p>
            ) : (
              <div className="relative">
                {loadingInvoices ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-panel-dark/70">
                    <Loader2
                      className="h-5 w-5 animate-spin text-brand-600"
                      strokeWidth={2}
                    />
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-cream-100/60 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                      <tr>
                        <th className="px-5 py-2.5 text-left">Period</th>
                        <th className="px-5 py-2.5 text-left">Invoice no.</th>
                        <th className="px-5 py-2.5 text-right">Amount</th>
                        <th className="px-5 py-2.5 text-left">Status</th>
                        <th className="px-5 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                      {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-5 py-3 text-sm font-semibold text-ink dark:text-cream-100">
                          {inv.period_label ?? inv.kind}
                          {inv.paid_at ? (
                            <p className="text-[11px] font-normal text-ink-muted dark:text-cream-400">
                              Paid {fmtDate(inv.paid_at)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-ink-muted dark:text-cream-400">
                          {inv.number}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-ink dark:text-cream-100">
                          RM {Number(inv.amount_myr).toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            tone={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "pending"
                                  ? "warning"
                                  : inv.status === "refunded"
                                    ? "info"
                                    : "danger"
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => downloadInvoice(inv.id)}
                            disabled={downloadingId === inv.id}
                            aria-label="Download invoice"
                            title="Download invoice / receipt"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 hover:text-ink disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:bg-hairline-dark/60"
                          >
                            {downloadingId === inv.id ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                strokeWidth={2}
                              />
                            ) : (
                              <Download
                                className="h-3.5 w-3.5"
                                strokeWidth={2}
                              />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invoiceTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 px-5 py-3 text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
                  <span>
                    Showing{" "}
                    {invoices.length === 0
                      ? 0
                      : (invoicePage - 1) * INVOICE_PAGE_SIZE + 1}
                    –
                    {(invoicePage - 1) * INVOICE_PAGE_SIZE + invoices.length} of{" "}
                    {invoiceTotal}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => loadInvoicePage(invoicePage - 1)}
                      disabled={loadingInvoices || invoicePage <= 1}
                      className="rounded-md border border-cream-200 px-3 py-1 text-xs text-ink hover:bg-cream-200 disabled:opacity-50 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark"
                    >
                      Previous
                    </button>
                    {Array.from(
                      { length: invoiceTotalPages },
                      (_, i) => i + 1,
                    ).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => loadInvoicePage(p)}
                        disabled={loadingInvoices || p === invoicePage}
                        aria-current={p === invoicePage ? "page" : undefined}
                        className={`min-w-[2rem] rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
                          p === invoicePage
                            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-200"
                            : "border-cream-200 text-ink hover:bg-cream-200 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => loadInvoicePage(invoicePage + 1)}
                      disabled={
                        loadingInvoices || invoicePage >= invoiceTotalPages
                      }
                      className="rounded-md border border-cream-200 px-3 py-1 text-xs text-ink hover:bg-cream-200 disabled:opacity-50 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-panel-dark"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            )}
          </div>
        </div>

        {/* RHS */}
        <aside className="space-y-5">
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-5 dark:border-accent-700/40 dark:bg-accent-700/15">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-500 text-white">
                <Zap className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Fast Credits balance
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Used by all 4 AI agents.
                </p>
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-accent-700 dark:text-accent-200">
              {balance.toLocaleString("en-MY")}
              <span className="text-sm font-medium text-ink-muted dark:text-cream-400">
                {" "}
                / {monthlyCreditQuota.toLocaleString("en-MY")}
              </span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-white/60 dark:bg-panel-dark/40">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${balancePct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowTopup(true)}
              disabled={!canEdit}
              className="mt-4 w-full rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
            >
              Top up — {bundleLabel("small")}
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/15 p-4 text-xs">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C5C0A] dark:text-[#F5C97A]"
              strokeWidth={2}
            />
            <p className="text-ink dark:text-cream-100">
              <strong>Heads up:</strong> Tax invoices include SST 8% per LHDN
              requirements. Manage your SST number under{" "}
              <a href="/settings/branding" className="font-semibold underline">
                Branding
              </a>
              .
            </p>
          </div>
        </aside>
      </div>

      {/* Top-up modal */}
      {showTopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink dark:text-cream-100">
                  Top up Fast Credits
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  {billplzBypass
                    ? "Credits are added immediately (Billplz bypass)."
                    : "You will be redirected to Billplz to complete payment."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTopup(false)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {(Object.keys(TOPUP_BUNDLES) as Array<keyof typeof TOPUP_BUNDLES>).map(
                (key) => {
                  const v = TOPUP_BUNDLES[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => topup(key)}
                      disabled={pending}
                      className="flex w-full items-center justify-between rounded-xl border border-cream-200 bg-white p-4 text-left transition-colors hover:border-accent-500 hover:bg-accent-50 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:hover:bg-accent-700/15"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink dark:text-cream-100">
                          {v.credits} credits
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {key === "small"
                            ? "Light usage · ~1 week"
                            : key === "medium"
                              ? "Balanced · ~3 weeks"
                              : "Heavy usage · 1 month+"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent-700 dark:text-accent-200">
                          RM {v.amount_myr}
                        </p>
                        {key !== "small" ? (
                          <p className="text-[10px] text-status-success">
                            Best value
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
            {pending ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                Processing…
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
