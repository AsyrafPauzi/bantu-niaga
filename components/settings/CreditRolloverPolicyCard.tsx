"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Loader2, RefreshCw } from "lucide-react";
import type { CreditRolloverPolicy } from "@/lib/settings/credit-rollover";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CreditRolloverPolicyCard() {
  const [policy, setPolicy] = useState<CreditRolloverPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/billing/credits-policy");
      const json = (await res.json()) as CreditRolloverPolicy & {
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not load credit policy");
        return;
      }
      setPolicy(json);
    } catch {
      setError("Could not load credit policy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <RefreshCw className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-ink dark:text-cream-100">
              Credit rollover policy
            </h3>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              How monthly bundles and top-ups behave in your shared pool.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50 dark:text-brand-200"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-status-danger">{error}</p>
      ) : policy ? (
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-status-success/30 bg-status-success/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-status-success">
                Top-up credits · roll over
              </p>
              <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
                {policy.topup_balance.toLocaleString("en-MY")}
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Purchased via Billing. Never expire — kept until you use them.
              </p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-800 dark:bg-brand-900/20">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">
                Monthly bundle · resets
              </p>
              <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
                {policy.bundle_balance.toLocaleString("en-MY")}
                <span className="text-sm font-medium text-ink-muted dark:text-cream-400">
                  {" "}
                  / {policy.max_monthly_bundle.toLocaleString("en-MY")}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {policy.monthly_credits_per_agent} credits per active AI agent
                per month. Unused bundle credits expire when each agent renews.
              </p>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-ink dark:text-cream-100">
            <li className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>Spend order:</strong> AI uses monthly bundle credits
                first, then top-up credits — so your paid top-ups are protected.
              </span>
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>Renewal:</strong> each AI add-on refreshes up to{" "}
                {policy.monthly_credits_per_agent} bundle credits on its billing
                date
                {policy.next_ai_addon_renewal_at
                  ? ` (next ${fmtDate(policy.next_ai_addon_renewal_at)})`
                  : ""}
                . Leftover bundle from that slot does not roll over.
              </span>
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>Active AI agents:</strong> {policy.active_ai_agents} ·
                total pool {policy.total_balance.toLocaleString("en-MY")}{" "}
                credits
                {policy.subscription_renewal_at
                  ? ` · plan renews ${fmtDate(policy.subscription_renewal_at)}`
                  : ""}
                .
              </span>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
