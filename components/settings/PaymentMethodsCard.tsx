"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CreditCard,
  Loader2,
  Plus,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

interface PaymentMethodsCardProps {
  canEdit: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const KIND_LABEL: Record<PaymentMethod["kind"], string> = {
  card: "Card",
  fpx: "FPX",
  wallet: "E-wallet",
};

export function PaymentMethodsCard({
  canEdit,
  selectedId,
  onSelect,
}: PaymentMethodsCardProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<PaymentMethod["kind"]>("card");
  const [label, setLabel] = useState("");
  const [masked, setMasked] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const selectedInit = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/billing/payment-methods");
      const json = (await res.json()) as {
        data?: PaymentMethod[];
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not load payment methods");
        return;
      }
      const rows = json.data ?? [];
      setMethods(rows);
      const def = rows.find((m) => m.is_default) ?? rows[0];
      if (def && !selectedInit.current) {
        onSelect(def.id);
        selectedInit.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [onSelect]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function addMethod() {
    if (!label.trim() || !masked.trim()) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/settings/billing/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label: label.trim(),
          masked: masked.trim(),
          provider: "manual",
          make_default: makeDefault || methods.length === 0,
        }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not add payment method");
        return;
      }
      setShowAdd(false);
      setLabel("");
      setMasked("");
      setMakeDefault(false);
      await refresh();
    });
  }

  function setDefault(id: string) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/settings/billing/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { message?: string };
        setError(json.message ?? "Could not update default");
        return;
      }
      onSelect(id);
      await refresh();
    });
  }

  function removeMethod(id: string) {
    if (!window.confirm("Remove this payment method?")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/settings/billing/payment-methods/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not remove payment method");
        return;
      }
      if (selectedId === id) onSelect(null);
      await refresh();
    });
  }

  return (
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
              Stored for top-ups and subscription renewals via Billplz.
            </p>
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="px-5 pt-3 text-xs text-status-danger">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : methods.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
          No payment methods yet.
        </p>
      ) : (
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              <span className="grid h-9 w-12 place-items-center rounded-md bg-gradient-to-br from-sky-700 to-sky-500 text-[8px] font-bold tracking-wider text-white">
                {m.provider === "billplz" ? "BILLPLZ" : KIND_LABEL[m.kind].slice(0, 4).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
                  {m.label}
                  {m.is_default ? <Badge tone="accent">Default</Badge> : null}
                  {selectedId === m.id ? (
                    <Badge tone="info">Selected for top-up</Badge>
                  ) : null}
                </p>
                <p className="text-[11px] text-ink-muted dark:text-cream-400">
                  {KIND_LABEL[m.kind]} · {m.masked}
                  {m.exp_month && m.exp_year
                    ? ` · exp ${m.exp_month}/${m.exp_year}`
                    : ""}
                </p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending || m.is_default}
                    onClick={() => setDefault(m.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 disabled:opacity-50 dark:text-brand-200"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Default
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onSelect(m.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted dark:text-cream-400"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Use
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeMethod(m.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 hover:text-status-danger dark:hover:bg-hairline-dark/40"
                    aria-label="Remove payment method"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <div className="border-t border-cream-200 p-5 dark:border-hairline-dark">
          <h4 className="text-sm font-semibold text-ink dark:text-cream-100">
            Add payment method
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-ink-muted">
              Type
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as PaymentMethod["kind"])
                }
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              >
                <option value="card">Card</option>
                <option value="fpx">FPX</option>
                <option value="wallet">E-wallet</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-ink-muted">
              Label
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Maybank Visa"
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>
            <label className="block text-xs font-medium text-ink-muted sm:col-span-2">
              Masked number / ID
              <input
                value={masked}
                onChange={(e) => setMasked(e.target.value)}
                placeholder="•••• 4242 or FPX · Maybank"
                className="mt-1 w-full rounded-lg border border-cream-300 px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />
            Set as default
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={addMethod}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
