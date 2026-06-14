"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CreditCard,
  Download,
  Loader2,
  Plus,
  Receipt,
  Star,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TOPUP_BUNDLES } from "@/lib/settings/schemas";

interface PaymentMethod {
  id: string;
  kind: "card" | "fpx" | "wallet";
  label: string;
  masked: string;
  owner_name: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  provider: string;
  created_at: string;
}

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
  initialMethods: PaymentMethod[];
  initialInvoices: Invoice[];
  creditBalance: number;
  monthlyCreditQuota: number;
  nextChargeMyr: number;
  nextRenewalAt: string | null;
  canEdit: boolean;
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
  initialMethods,
  initialInvoices,
  creditBalance,
  monthlyCreditQuota,
  nextChargeMyr,
  nextRenewalAt,
  canEdit,
}: BillingViewProps) {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [balance, setBalance] = useState(creditBalance);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showTopup, setShowTopup] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function makeDefault(id: string) {
    setError(null);
    const res = await fetch(`/api/settings/billing/payment-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.message ?? "Could not set default");
      return;
    }
    setMethods((s) =>
      s.map((m) => ({ ...m, is_default: m.id === id })),
    );
    refresh();
  }

  async function removeMethod(id: string) {
    setError(null);
    if (!confirm("Remove this payment method?")) return;
    const res = await fetch(`/api/settings/billing/payment-methods/${id}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.message ?? "Could not remove");
      return;
    }
    setMethods((s) => s.filter((m) => m.id !== id));
    refresh();
  }

  function bundleLabel(b: keyof typeof TOPUP_BUNDLES) {
    const v = TOPUP_BUNDLES[b];
    return `RM ${v.amount_myr} → ${v.credits} credits`;
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
      // Optimistically prepend an invoice row.
      const v = TOPUP_BUNDLES[bundle];
      setInvoices((s) => [
        {
          id: json.invoice_id,
          number: "TU-" + json.invoice_id.slice(0, 6),
          kind: "topup",
          period_label: "Fast Credits top-up",
          amount_myr: v.amount_myr,
          tax_myr: 0,
          status: "paid",
          paid_at: new Date().toISOString(),
          pdf_url: null,
          created_at: new Date().toISOString(),
        },
        ...s,
      ]);
      setShowTopup(false);
      refresh();
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
              Auto-renew via{" "}
              {methods.find((m) => m.is_default)?.label ?? "your default method"}
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
          {/* Payment methods */}
          <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <CreditCard className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Payment methods
                  </h3>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Billplz / Curlec / FPX direct debit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                disabled={!canEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                Add method
              </button>
            </div>
            {methods.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
                No payment methods yet. Add one to enable auto-renewal and
                Fast Credit top-ups.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {methods.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-9 w-12 place-items-center rounded-md text-[10px] font-bold tracking-wider text-white ${
                          m.kind === "card"
                            ? "bg-gradient-to-br from-blue-700 to-blue-500"
                            : m.kind === "fpx"
                              ? "bg-gradient-to-br from-emerald-700 to-emerald-500"
                              : "bg-gradient-to-br from-purple-700 to-purple-500"
                        }`}
                      >
                        {m.kind === "card"
                          ? "VISA"
                          : m.kind === "fpx"
                            ? "FPX"
                            : "EWAL"}
                      </span>
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
                          {m.label}
                          {m.is_default ? (
                            <Badge tone="accent">Default</Badge>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-ink-muted dark:text-cream-400">
                          {m.masked}
                          {m.exp_month && m.exp_year
                            ? ` · Exp ${String(m.exp_month).padStart(2, "0")}/${String(m.exp_year).slice(-2)}`
                            : ""}
                          {m.owner_name ? ` · ${m.owner_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!m.is_default && canEdit ? (
                        <button
                          type="button"
                          onClick={() => makeDefault(m.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                        >
                          <Star className="h-3 w-3" strokeWidth={2} />
                          Make default
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => removeMethod(m.id)}
                          aria-label="Remove"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 text-status-danger hover:bg-status-danger/10 dark:border-hairline-dark"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
            {invoices.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
                No invoices yet.
              </p>
            ) : (
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
                          <a
                            href={inv.pdf_url ?? "#"}
                            onClick={(e) => {
                              if (!inv.pdf_url) e.preventDefault();
                            }}
                            aria-label="Download invoice"
                            title={
                              inv.pdf_url
                                ? "Download PDF"
                                : "PDF available after billing run"
                            }
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:bg-hairline-dark/60 ${
                              inv.pdf_url ? "" : "opacity-50"
                            }`}
                          >
                            <Download
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                            />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      {/* Add payment method modal */}
      {showAdd ? (
        <AddPaymentMethodModal
          onClose={() => setShowAdd(false)}
          onSaved={(pm) => {
            setMethods((s) => {
              if (pm.is_default) {
                return [pm, ...s.map((m) => ({ ...m, is_default: false }))];
              }
              return [pm, ...s];
            });
            setShowAdd(false);
            refresh();
          }}
        />
      ) : null}

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
                  Charged to{" "}
                  {methods.find((m) => m.is_default)?.label ?? "your default method"}
                  .
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
                Processing payment…
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function AddPaymentMethodModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (pm: PaymentMethod) => void;
}) {
  const [kind, setKind] = useState<"card" | "fpx" | "wallet">("card");
  const [label, setLabel] = useState("");
  const [last4, setLast4] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!label.trim()) {
      setError("Give this method a label");
      return;
    }
    if (kind === "card" && !/^\d{4}$/.test(last4)) {
      setError("Enter the last 4 digits");
      return;
    }
    startTransition(async () => {
      const masked = kind === "card" ? `•••• ${last4}` : `•••• ${last4 || "0000"}`;
      const res = await fetch("/api/settings/billing/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label: label.trim(),
          masked,
          owner_name: ownerName.trim() || null,
          exp_month: kind === "card" && expMonth ? Number(expMonth) : null,
          exp_year: kind === "card" && expYear ? Number(expYear) : null,
          provider: kind === "fpx" ? "curlec" : "billplz",
          make_default: makeDefault,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? json?.error ?? "Could not add method");
        return;
      }
      onSaved(json.payment_method);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink dark:text-cream-100">
              Add payment method
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              We never store full card numbers. Tokenisation handled by the
              gateway in production.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(["card", "fpx", "wallet"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  kind === k
                    ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-700/15 dark:text-accent-200"
                    : "border-cream-300 bg-white text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                }`}
              >
                {k === "card"
                  ? "Card"
                  : k === "fpx"
                    ? "FPX direct debit"
                    : "E-wallet"}
              </button>
            ))}
          </div>

          <Field label="Label">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                kind === "card"
                  ? "Visa ending 4242"
                  : kind === "fpx"
                    ? "Maybank FPX"
                    : "Touch n Go eWallet"
              }
              className={inputCx}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={kind === "card" ? "Last 4 digits" : "Reference (last 4)"}
            >
              <input
                value={last4}
                onChange={(e) =>
                  setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="4242"
                inputMode="numeric"
                className={inputCx}
              />
            </Field>
            <Field label="Cardholder / Owner name">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={inputCx}
              />
            </Field>
          </div>

          {kind === "card" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exp month">
                <input
                  value={expMonth}
                  onChange={(e) =>
                    setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  placeholder="08"
                  className={inputCx}
                />
              </Field>
              <Field label="Exp year">
                <input
                  value={expYear}
                  onChange={(e) =>
                    setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="2029"
                  className={inputCx}
                />
              </Field>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
              className="h-4 w-4 accent-accent-500"
            />
            <span className="text-ink dark:text-cream-100">
              Use as default for renewals &amp; top-ups
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : null}
            Save method
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
        {label}
      </span>
      {children}
    </label>
  );
}
