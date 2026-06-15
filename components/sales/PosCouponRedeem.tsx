"use client";

import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Forward-compat plumbing for the future POS surface (spec §5).
 *
 * Renders a small "Have a coupon code?" card that POSTs to
 * /api/marketing/coupons/validate and shows the discount math or the
 * spec-§4 failure reason. Pure validate — no mutation. The real POS
 * will flip this into a redeem call once it has an order_ref.
 */

interface ValidateOk {
  ok: true;
  discount_myr: number;
  coupon: {
    code: string;
    type: "PCT" | "AMT";
    value: number;
  };
}

interface ValidateFail {
  ok: false;
  reason: string;
  coupon?: { code?: string };
}

const REASON_LABEL: Record<string, string> = {
  not_found: "Code not found.",
  paused: "This coupon is paused.",
  expired: "This coupon has expired.",
  not_yet_active: "This coupon isn't active yet.",
  min_subtotal: "Subtotal is below the coupon's minimum.",
  total_limit_reached: "This coupon is fully redeemed.",
  per_customer_limit_reached: "You've already used this coupon.",
  segment_mismatch: "This coupon is for a different cohort.",
};

export function PosCouponRedeem() {
  const [code, setCode] = useState("");
  const [subtotal, setSubtotal] = useState("100");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; discount: number; code: string }
    | { ok: false; reason: string }
    | null
  >(null);

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          subtotal_myr: Number(subtotal) || 0,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | ValidateOk
        | ValidateFail
        | Record<string, unknown>;
      if (!res.ok) {
        setResult({
          ok: false,
          reason:
            typeof (body as { error?: string }).error === "string"
              ? (body as { error: string }).error
              : `request failed (${res.status})`,
        });
        return;
      }
      if ((body as ValidateOk).ok) {
        const ok = body as ValidateOk;
        setResult({
          ok: true,
          discount: ok.discount_myr,
          code: ok.coupon.code,
        });
      } else {
        const fail = body as ValidateFail;
        setResult({ ok: false, reason: fail.reason });
      }
    } catch (err) {
      setResult({
        ok: false,
        reason: err instanceof Error ? err.message : "request failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
          <Ticket className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Have a coupon code?
          </p>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Validate-only stub for the upcoming POS. Calls{" "}
            <code className="font-mono">/api/marketing/coupons/validate</code>.
          </p>
        </div>
      </div>

      <form onSubmit={onApply} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr,140px,auto]">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          placeholder="RAYA20"
          maxLength={32}
          disabled={busy}
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wider text-ink shadow-card focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <div className="relative">
          <input
            type="number"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            placeholder="100"
            min={0}
            step={0.01}
            disabled={busy}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 pr-10 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted dark:text-cream-400">
            MYR
          </span>
        </div>
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} /> : null}
          Apply
        </button>
      </form>

      {result ? (
        <div
          className={cn(
            "mt-3 rounded-md px-3 py-2 text-xs",
            result.ok
              ? "bg-status-success/10 text-status-success"
              : "bg-status-danger/10 text-status-danger",
          )}
        >
          {result.ok ? (
            <>
              <span className="font-semibold">{result.code}</span> applies a
              discount of{" "}
              <span className="font-bold tabular-nums">
                RM {result.discount.toFixed(2)}
              </span>
              .
            </>
          ) : (
            <>
              <span className="font-semibold">Cannot apply:</span>{" "}
              {REASON_LABEL[result.reason] ?? result.reason}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
