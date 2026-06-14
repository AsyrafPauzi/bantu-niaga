import { Check, Copy, Eye, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { TIERS, tierBy, type TierKey } from "@/lib/settings/plans";
import {
  PILLARS,
  PILLAR_LABEL,
  TIER_PILLARS,
  type Pillar,
} from "@/lib/auth/entitlements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  PageBody,
  Section,
  ToggleVisual,
  formatMyr,
} from "@/components/super-admin/primitives";

export const dynamic = "force-dynamic";

async function loadTierCounts(): Promise<Record<TierKey, number>> {
  const svc = createServiceRoleClient();
  const { data } = await svc.from("businesses").select("tier");
  const counts: Record<TierKey, number> = {
    starter: 0,
    micro: 0,
    sme: 0,
    enterprise: 0,
  };
  for (const r of data ?? []) {
    const t = r.tier as TierKey;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

function tierCardBg(tier: TierKey): { headBg: string; headFg: string } {
  switch (tier) {
    case "starter":
      return { headBg: "bg-cream-200", headFg: "text-ink" };
    case "micro":
      return { headBg: "bg-brand-50", headFg: "text-brand-500" };
    case "sme":
      return { headBg: "bg-brand-100", headFg: "text-brand-700" };
    case "enterprise":
      return { headBg: "bg-accent-100", headFg: "text-accent-700" };
  }
}

export default async function SuperAdminPlans() {
  const tierCounts = await loadTierCounts();

  return (
    <>
      <PageTopbar
        title="Plans"
        subtitle="4 active tiers · tier → module entitlements"
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Eye className="h-3.5 w-3.5" />
              Preview pricing page
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <Plus className="h-3.5 w-3.5" />
              Add plan
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap items-start">
          {TIERS.map((plan) => {
            const count = tierCounts[plan.key];
            const mrr = count * (plan.priceMyr ?? 0);
            const unlocked = TIER_PILLARS[plan.key];
            const { headBg, headFg } = tierCardBg(plan.key);
            return (
              <div
                key={plan.key}
                className="flex-1 min-w-[260px] max-w-sm overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card"
              >
                <div className={`${headBg} p-5 space-y-2.5`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-lg font-bold ${headFg}`}>
                      {plan.label}
                    </p>
                    <span className="inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-ink">
                      {count} tenants
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <p className={`text-3xl font-bold ${headFg}`}>
                      {plan.priceMyr === 0
                        ? "RM 0"
                        : formatMyr(plan.priceMyr ?? 0)}
                    </p>
                    <p className={`text-sm font-semibold ${headFg} pb-1`}>
                      {plan.cadence}
                    </p>
                  </div>
                  <p className={`text-xs ${headFg}`}>{plan.blurb}</p>
                  <div className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5">
                    <span className="text-[11px] font-semibold text-ink-muted">
                      MRR
                    </span>
                    <span className="text-sm font-bold text-ink">
                      {formatMyr(mrr)}
                    </span>
                  </div>
                </div>
                <div className="p-5 space-y-3.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Unlocked modules
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {PILLARS.map((p) => {
                        const on = unlocked.includes(p);
                        return (
                          <span
                            key={p}
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              on
                                ? "bg-brand-50 text-brand-700"
                                : "bg-cream-200 text-ink-subtle"
                            }`}
                          >
                            {PILLAR_LABEL[p]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Includes
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-xs text-ink"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-cream-300 bg-cream-100 px-5 py-3">
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-cream-100">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="grid h-7 w-7 place-items-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100"
                      aria-label="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="grid h-7 w-7 place-items-center rounded-md border border-cream-300 bg-white text-status-danger hover:bg-cream-100"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Section
          title="Tier → module matrix"
          description="Single source of truth: lib/auth/entitlements.ts. Each row shows which modules a tier unlocks."
        >
          <div className="overflow-hidden rounded-lg border border-cream-300">
            <div className="grid grid-cols-[140px_repeat(6,minmax(0,1fr))] bg-cream-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              <span>Tier</span>
              {PILLARS.map((p) => (
                <span key={p} className="text-center">
                  {PILLAR_LABEL[p]}
                </span>
              ))}
            </div>
            {(["starter", "micro", "sme", "enterprise"] as TierKey[]).map(
              (t) => {
                const unlocked = TIER_PILLARS[t];
                return (
                  <div
                    key={t}
                    className="grid grid-cols-[140px_repeat(6,minmax(0,1fr))] items-center border-t border-cream-300 px-4 py-3"
                  >
                    <span className="text-sm font-bold text-ink">
                      {tierBy(t)?.label}
                    </span>
                    {PILLARS.map((p) => (
                      <div
                        key={p}
                        className="flex items-center justify-center"
                      >
                        <ToggleVisual
                          on={unlocked.includes(p as Pillar)}
                          ariaLabel={`${t} unlocks ${p}`}
                        />
                      </div>
                    ))}
                  </div>
                );
              },
            )}
          </div>
        </Section>

        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-100">
            <Info className="h-4 w-4 text-brand-700" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-brand-700">
              Plan changes propagate within seconds
            </p>
            <p className="mt-0.5 text-xs text-brand-700">
              The matrix is read at runtime by route guards and the sidebar.
              Tenants on a downgraded plan keep access for the remainder of
              the billing period; locked modules then show an upgrade banner.
              Editing the toggles here is wired up to the matrix override
              (coming next).
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}
