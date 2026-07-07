"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, Sparkles, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TIERS, tierBy, type TierKey } from "@/lib/settings/plans";

interface SubscriptionViewProps {
  tier: "starter" | "micro" | "sme" | "enterprise";
  subscriptionStatus: "active" | "past_due" | "cancelled" | "trial";
  subscriptionRenewalAt: string | null;
  usage: {
    seats: number;
    customers: number;
    credits_used_this_month: number;
  };
  canEdit: boolean;
  /** Pillar key that caused the redirect to this page, if any. */
  lockedPillar?: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PILLAR_LABELS: Record<string, string> = {
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
  hr: "HR",
  marketing: "Marketing",
};

const PILLAR_MIN_TIER: Record<string, TierKey> = {
  finance: "starter",
  admin: "micro",
  operations: "micro",
  sales: "sme",
  hr: "sme",
  marketing: "enterprise",
};

export function SubscriptionView({
  tier,
  subscriptionStatus,
  subscriptionRenewalAt,
  usage,
  canEdit,
  lockedPillar,
}: SubscriptionViewProps) {
  const router = useRouter();
  const [confirmTier, setConfirmTier] = useState<TierKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = tierBy(tier);
  const monthlyCredits = current?.quotas.fastCreditsMonthly ?? 0;
  const seats = current?.quotas.seats ?? 1;
  const customers = current?.quotas.customers ?? 0;

  const lockedLabel = lockedPillar ? PILLAR_LABELS[lockedPillar] : null;
  const lockedMinTier = lockedPillar
    ? tierBy(PILLAR_MIN_TIER[lockedPillar] ?? "enterprise")
    : null;

  function requestSwitch(t: TierKey) {
    setError(null);
    setConfirmTier(t);
  }

  function applySwitch() {
    if (!confirmTier) return;
    startTransition(async () => {
      const res = await fetch("/api/settings/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: confirmTier }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? json?.error ?? "Could not change plan");
        return;
      }
      setConfirmTier(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {lockedLabel && lockedMinTier ? (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-4 text-sm text-ink dark:text-cream-100">
          <p className="font-semibold">
            {lockedLabel} is not unlocked on your current plan
          </p>
          <p className="mt-1 text-ink-muted dark:text-cream-400">
            Switch to <strong>{lockedMinTier.label}</strong>
            {lockedMinTier.priceMyr != null
              ? ` (RM ${lockedMinTier.priceMyr}${lockedMinTier.cadence})`
              : ""}{" "}
            or higher to access the {lockedLabel} module.
          </p>
        </div>
      ) : null}

      {/* Current plan banner */}
      <div className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-cream-50 p-6 shadow-card dark:border-accent-700/40 dark:from-accent-700/15 dark:to-panel-dark">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-500 text-white shadow-card">
              <Crown className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ink dark:text-cream-100">
                  {current?.label ?? tier} tier
                </h2>
                <Badge tone="accent">Current</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
                {current?.priceMyr != null
                  ? `RM ${current.priceMyr.toFixed(0)}${current.cadence}`
                  : "Custom pricing"}
                {" · "}
                {subscriptionStatus === "trial" ? (
                  <>
                    Trial ends <strong>{fmtDate(subscriptionRenewalAt)}</strong>
                  </>
                ) : tier === "starter" ? (
                  <>
                    Free plan renews{" "}
                    <strong>{fmtDate(subscriptionRenewalAt)}</strong>
                  </>
                ) : (
                  <>
                    Renews <strong>{fmtDate(subscriptionRenewalAt)}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <UsageRow
            label="Staff seats"
            used={usage.seats}
            total={seats}
            icon={Users}
          />
          <UsageRow
            label="Customers"
            used={usage.customers}
            total={customers}
            icon={Users}
            formatter={(n) =>
              Number.isFinite(n)
                ? n.toLocaleString("en-MY")
                : "∞"
            }
          />
          <UsageRow
            label="AI add-on credits"
            used={usage.credits_used_this_month}
            total={monthlyCredits}
            icon={Zap}
          />
        </div>
      </div>

      {/* Tier comparison */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Compare plans
          </h2>
          {!canEdit ? (
            <Badge tone="warning">Owner role required to change plan</Badge>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const isCurrent = t.key === tier;
            return (
              <div
                key={t.key}
                className={`flex flex-col gap-4 rounded-xl border p-5 transition-colors ${
                  isCurrent
                    ? "border-accent-500 bg-white shadow-card ring-2 ring-accent-500/40 dark:bg-panel-dark"
                    : "border-cream-200 bg-white shadow-card hover:border-brand-300 dark:border-hairline-dark dark:bg-panel-dark"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-ink dark:text-cream-100">
                      {t.label}
                    </h3>
                    {isCurrent ? (
                      <Badge tone="accent">Current</Badge>
                    ) : t.highlighted ? (
                      <Badge tone="brand">Most popular</Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-ink-muted dark:text-cream-400">
                    {t.blurb}
                  </p>
                </div>
                <div>
                  <span className="text-3xl font-bold text-ink dark:text-cream-100">
                    {t.priceMyr != null ? `RM ${t.priceMyr}` : "Custom"}
                  </span>
                  <span className="text-sm text-ink-muted dark:text-cream-400">
                    {t.cadence}
                  </span>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-ink dark:text-cream-100"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success"
                        strokeWidth={2.5}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={isCurrent || !canEdit || pending}
                  onClick={() => requestSwitch(t.key)}
                  className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                    isCurrent
                      ? "border border-cream-300 bg-cream-100 text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-400"
                      : "bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60"
                  }`}
                >
                  {isCurrent ? "Active" : "Switch plan"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmation modal */}
      {confirmTier ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-500 text-white">
                <Sparkles className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-ink dark:text-cream-100">
                  Switch to {tierBy(confirmTier)?.label}?
                </h3>
                <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
                  Your plan will change immediately. We&apos;ll prorate the
                  difference on your next invoice (
                  {fmtDate(subscriptionRenewalAt)}).
                </p>
              </div>
            </div>
            {error ? (
              <p className="mt-3 rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmTier(null)}
                disabled={pending}
                className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applySwitch}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : null}
                Confirm switch
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UsageRow({
  label,
  used,
  total,
  icon: Icon,
  formatter,
}: {
  label: string;
  used: number;
  total: number;
  icon: typeof Users;
  formatter?: (n: number) => string;
}) {
  const fmt = formatter ?? ((n: number) => n.toLocaleString("en-MY"));
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const warn = pct >= 80;
  return (
    <div className="rounded-lg bg-white/70 p-3 dark:bg-panel-dark/40">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
          <Icon className="h-3 w-3" strokeWidth={2} />
          {label}
        </span>
        <span className="text-[11px] text-ink-muted dark:text-cream-400">
          {fmt(used)} / {fmt(total)}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-cream-200 dark:bg-hairline-dark">
        <div
          className={`h-full rounded-full transition-all ${
            warn ? "bg-status-warning" : "bg-accent-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
