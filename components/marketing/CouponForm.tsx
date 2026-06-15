"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { generateCouponCode } from "@/lib/marketing/coupon-code";

type CouponType = "PCT" | "AMT";
type CouponStatus = "active" | "paused" | "expired";

/**
 * Pencil-style coupon form, used by both the create page and the edit
 * panel on the detail page.
 *
 * Submission behaviour: the parent owns the `onSubmit` handler — this
 * component only validates client-side, stages the JSON body, and
 * shows the busy / error state.
 */

export interface CouponFormValues {
  code: string;
  name: string;
  type: CouponType;
  value: string;
  min_subtotal_myr: string;
  valid_from: string;
  valid_until: string;
  total_limit: string;
  per_customer_limit: string;
  segment_id: string;
  status: CouponStatus;
}

export interface CouponFormProps {
  /** Initial values — used to hydrate edit mode. */
  initialValues?: Partial<CouponFormValues>;
  /** Lock the code input (edit mode — code is immutable per spec). */
  codeLocked?: boolean;
  /** Pre-filtered segments option list. */
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit: (body: CouponSubmitBody) => Promise<void>;
}

export interface CouponSubmitBody {
  code?: string;
  name?: string | null;
  type: CouponType;
  value: number;
  min_subtotal_myr?: number;
  valid_from?: string;
  valid_until?: string | null;
  total_limit?: number | null;
  per_customer_limit?: number;
  segment_id?: string | null;
  status?: CouponStatus;
}

interface SegmentOption {
  id: string;
  name: string;
}

const EMPTY_VALUES: CouponFormValues = {
  code: "",
  name: "",
  type: "PCT",
  value: "",
  min_subtotal_myr: "",
  valid_from: "",
  valid_until: "",
  total_limit: "",
  per_customer_limit: "1",
  segment_id: "",
  status: "active",
};

function inputClass(extra?: string, disabled?: boolean) {
  return cn(
    "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
    "dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:focus:ring-brand-900/40",
    disabled && "cursor-not-allowed opacity-60",
    extra,
  );
}

export function CouponForm({
  initialValues,
  codeLocked = false,
  submitLabel = "Save coupon",
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
}: CouponFormProps) {
  const [values, setValues] = useState<CouponFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/marketing/segments");
        if (!res.ok) {
          throw new Error(`segments load failed (${res.status})`);
        }
        const body = (await res.json()) as {
          data?: { id: string; name: string }[];
        };
        if (!cancelled) {
          setSegments(
            (body.data ?? []).map((r) => ({ id: r.id, name: r.name })),
          );
        }
      } catch {
        // Non-fatal — the form just shows an empty dropdown.
      } finally {
        if (!cancelled) setSegmentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(p: Partial<CouponFormValues>) {
    setValues((v) => ({ ...v, ...p }));
  }

  function regenerateCode() {
    if (codeLocked) return;
    patch({ code: generateCouponCode(8) });
  }

  const valueSuffix = useMemo(() => (values.type === "PCT" ? "%" : "MYR"), [values.type]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const valueNum = Number(values.value);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      setError("Value must be a positive number.");
      return;
    }
    if (values.type === "PCT" && (valueNum <= 0 || valueNum > 100)) {
      setError("Percentage must be between 0 and 100.");
      return;
    }
    if (values.code && values.code.trim().length < 3) {
      setError("Code must be at least 3 characters.");
      return;
    }

    const body: CouponSubmitBody = {
      type: values.type,
      value: valueNum,
    };
    if (!codeLocked && values.code.trim()) body.code = values.code.trim();
    if (values.name.trim()) body.name = values.name.trim();
    else if (initialValues?.name !== undefined) body.name = null;
    if (values.min_subtotal_myr !== "")
      body.min_subtotal_myr = Number(values.min_subtotal_myr);
    if (values.valid_from)
      body.valid_from = new Date(values.valid_from).toISOString();
    if (values.valid_until)
      body.valid_until = new Date(values.valid_until).toISOString();
    else if (initialValues?.valid_until) body.valid_until = null;
    if (values.total_limit !== "")
      body.total_limit = Math.max(1, Math.floor(Number(values.total_limit)));
    else if (initialValues?.total_limit) body.total_limit = null;
    if (values.per_customer_limit !== "")
      body.per_customer_limit = Math.max(
        0,
        Math.floor(Number(values.per_customer_limit)),
      );
    if (values.segment_id) body.segment_id = values.segment_id;
    else if (initialValues?.segment_id) body.segment_id = null;
    if (values.status !== "expired") body.status = values.status;

    setBusy(true);
    try {
      await onSubmit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Code" required helper={codeLocked ? "Code is immutable after creation." : "3–32 chars; letters, numbers, dashes."}>
          <div className="flex gap-2">
            <input
              type="text"
              value={values.code}
              onChange={(e) =>
                patch({ code: e.target.value.toUpperCase().replace(/\s+/g, "") })
              }
              placeholder="RAYA20"
              maxLength={32}
              disabled={busy || codeLocked}
              className={inputClass("font-mono uppercase tracking-wider", busy || codeLocked)}
            />
            {codeLocked ? null : (
              <button
                type="button"
                onClick={regenerateCode}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
                Generate
              </button>
            )}
          </div>
        </Field>

        <Field label="Name" helper="Optional internal nickname (e.g. ‘Hari Raya Sale’).">
          <input
            type="text"
            value={values.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Hari Raya Sale"
            maxLength={120}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
      </div>

      <Field label="Discount type" required>
        <div className="flex gap-2">
          <TypeRadio
            label="Percentage"
            sub="% off"
            active={values.type === "PCT"}
            onClick={() => patch({ type: "PCT" })}
            disabled={busy}
          />
          <TypeRadio
            label="Ringgit"
            sub="RM off"
            active={values.type === "AMT"}
            onClick={() => patch({ type: "AMT" })}
            disabled={busy}
          />
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Discount value (${valueSuffix})`} required>
          <div className="relative">
            <input
              type="number"
              value={values.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder={values.type === "PCT" ? "20" : "10.00"}
              step={values.type === "PCT" ? 1 : 0.01}
              min={0}
              max={values.type === "PCT" ? 100 : undefined}
              disabled={busy}
              className={inputClass("pr-12", busy)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted dark:text-cream-400">
              {valueSuffix}
            </span>
          </div>
        </Field>

        <Field label="Minimum subtotal (MYR)" helper="Order subtotal must be at least this much.">
          <input
            type="number"
            value={values.min_subtotal_myr}
            onChange={(e) => patch({ min_subtotal_myr: e.target.value })}
            placeholder="0"
            step={0.01}
            min={0}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Valid from" helper="Defaults to now if blank.">
          <input
            type="datetime-local"
            value={values.valid_from}
            onChange={(e) => patch({ valid_from: e.target.value })}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
        <Field label="Valid until" helper="Leave blank for no expiry.">
          <input
            type="datetime-local"
            value={values.valid_until}
            onChange={(e) => patch({ valid_until: e.target.value })}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Total redemption limit" helper="Across the whole business. Blank = unlimited.">
          <input
            type="number"
            value={values.total_limit}
            onChange={(e) => patch({ total_limit: e.target.value })}
            placeholder="No limit"
            step={1}
            min={1}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
        <Field label="Per-customer limit" helper="0 = no per-customer cap.">
          <input
            type="number"
            value={values.per_customer_limit}
            onChange={(e) => patch({ per_customer_limit: e.target.value })}
            step={1}
            min={0}
            disabled={busy}
            className={inputClass(undefined, busy)}
          />
        </Field>
      </div>

      <Field
        label="Segment scope"
        helper="Optional — restrict redemption to a saved cohort."
      >
        <select
          value={values.segment_id}
          onChange={(e) => patch({ segment_id: e.target.value })}
          disabled={busy || segmentsLoading}
          className={inputClass(undefined, busy || segmentsLoading)}
        >
          <option value="">— Any customer —</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Status">
        <div className="flex gap-2">
          {(
            [
              { v: "active", label: "Active" },
              { v: "paused", label: "Paused" },
            ] as { v: CouponStatus; label: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => patch({ status: opt.v })}
              disabled={busy}
              className={cn(
                "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                values.status === opt.v
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
                busy && "cursor-not-allowed opacity-60",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {error ? (
        <p className="rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cream-200 pt-4 dark:border-hairline-dark">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          ) : null}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-ink dark:text-cream-100">
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {helper ? (
        <span className="block text-xs text-ink-muted dark:text-cream-400">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function TypeRadio({
  label,
  sub,
  active,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
          : "border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] uppercase tracking-wider">{sub}</span>
    </button>
  );
}
