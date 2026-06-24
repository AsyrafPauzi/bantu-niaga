import { TrendingUp } from "lucide-react";
import { loadDataMonitor, loadOverview } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";

export const dynamic = "force-dynamic";

export default async function SuperAdminInvestorMetrics() {
  const [{ kpis, planMix }, monitor] = await Promise.all([
    loadOverview(),
    loadDataMonitor(),
  ]);

  const totalTenants = planMix.reduce((s, p) => s + p.count, 0);
  const arpu = kpis.activeTenants
    ? Math.round(kpis.mrrMyr / kpis.activeTenants)
    : 0;
  const arr = kpis.mrrMyr * 12;

  return (
    <>
      <PageTopbar
        title="Investor metrics"
        subtitle="A one-screen view of the numbers you brief investors with"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-md bg-status-success/10 px-2.5 py-1 text-[11px] font-bold text-status-success">
            <TrendingUp className="h-3 w-3" />
            Live · refreshed every load
          </span>
        }
      />
      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="MRR"
            value={formatMyr(kpis.mrrMyr)}
            delta="recurring revenue"
            trend="up"
          />
          <KpiCard
            label="ARR projection"
            value={formatMyr(arr)}
            subtle="MRR × 12"
          />
          <KpiCard
            label="Paying tenants"
            value={kpis.activeTenants}
            delta={`of ${totalTenants} signed up`}
            trend="up"
          />
          <KpiCard
            label="ARPU / tenant"
            value={formatMyr(arpu)}
            subtle="across paying plans"
          />
        </div>

        <Section
          title="Plan mix"
          description="The conversion ladder. Free → Starter → Growth → Pro reflects how SMEs scale on the platform."
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {planMix.map((p) => {
              const share = totalTenants > 0 ? (p.count / totalTenants) * 100 : 0;
              return (
                <div
                  key={p.tier}
                  className="rounded-lg border border-cream-300 bg-cream-100 p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    {p.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink">{p.count}</p>
                  <p className="text-xs text-ink-muted">
                    {share.toFixed(0)}% · {formatMyr(p.monthlyMyr)}/mo
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="Data flywheel"
          description="Every tenant adds proprietary records that improve our AI recommendations and benchmarks — a defensible moat."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Total records" value={formatInt(monitor.totalRecords)} />
            <Stat label="MoM growth" value={`${monitor.growthRatePct}%`} />
            <Stat
              label="Top contributing tenants"
              value={monitor.topContributors.length || "—"}
            />
          </div>
        </Section>
      </PageBody>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-cream-300 bg-cream-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
