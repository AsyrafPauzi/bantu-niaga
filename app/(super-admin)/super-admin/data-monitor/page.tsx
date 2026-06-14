import {
  Database,
  Receipt,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { loadDataMonitor } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
} from "@/components/super-admin/primitives";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt,
  "shopping-cart": ShoppingCart,
  users: Users,
  sparkles: Sparkles,
  zap: Zap,
  store: Store,
  database: Database,
};

export default async function SuperAdminDataMonitor() {
  const data = await loadDataMonitor();

  // Build a tiny stacked-area chart of monthly volume.
  const series = data.monthly;
  const maxStack =
    Math.max(...series.map((m) => m.transactional + m.ai + m.marketing)) ||
    1;

  return (
    <>
      <PageTopbar
        title="Data monitor"
        subtitle="Live volume + growth across the Bantu Niaga platform"
        right={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
            <Database className="h-3.5 w-3.5" />
            Export investor deck
          </button>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Total records"
            value={formatInt(data.totalRecords)}
            delta="Live count"
            trend="up"
          />
          <KpiCard
            label="MoM growth"
            value={`${data.growthRatePct}%`}
            delta="data network effect"
            trend="up"
          />
          <KpiCard
            label="AI signals / 7d"
            value={formatInt(
              data.byType.find((b) => b.label === "AI invocations")?.total ??
                0,
            )}
            subtle="across all agents"
          />
          <KpiCard
            label="Contributors"
            value={data.topContributors.length || "—"}
            subtle="tenants generating data"
          />
        </div>

        <Section
          title="Monthly volume by data type"
          description="The platform compounds — every new tenant adds finance, ops, AI, and marketing records that train recommendations across the network."
        >
          <div className="grid grid-cols-6 items-end gap-3 h-56">
            {series.map((m) => {
              const total = m.transactional + m.ai + m.marketing;
              const h = (total / maxStack) * 100;
              const tH = (m.transactional / total) * h;
              const aH = (m.ai / total) * h;
              const mH = (m.marketing / total) * h;
              return (
                <div
                  key={m.month}
                  className="flex h-full flex-col items-stretch justify-end gap-0.5 text-center"
                >
                  <div className="flex h-full w-full flex-col-reverse rounded-md overflow-hidden bg-cream-100">
                    <span
                      className="bg-brand-500"
                      style={{ height: `${tH}%` }}
                      title={`Transactional ${m.transactional}`}
                    />
                    <span
                      className="bg-accent-500"
                      style={{ height: `${aH}%` }}
                      title={`AI ${m.ai}`}
                    />
                    <span
                      className="bg-status-success"
                      style={{ height: `${mH}%` }}
                      title={`Marketing ${m.marketing}`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-ink-muted">
                    {m.month}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-ink">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
              Transactional
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent-500" />
              AI generated
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink">
              <span className="h-2.5 w-2.5 rounded-sm bg-status-success" />
              Marketing
            </span>
          </div>
        </Section>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
          {data.byType.map((b) => {
            const Icon = ICONS[b.icon] ?? Database;
            return (
              <div
                key={b.label}
                className="rounded-xl border border-cream-300 bg-white p-4 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-100 text-brand-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-status-success/10 px-2 py-0.5 text-[10px] font-bold text-status-success">
                    <TrendingUp className="h-3 w-3" />
                    {b.delta}
                  </span>
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                  {b.label}
                </p>
                <p className="text-2xl font-bold text-ink">
                  {formatInt(b.total)}
                </p>
              </div>
            );
          })}
        </div>

        <Section
          title="Top contributing tenants"
          description="The businesses producing the most records this month. A flywheel signal — power tenants surface up here."
        >
          {data.topContributors.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No data yet. Tenants will appear here as invoices, POS sales, and
              AI invocations accumulate.
            </p>
          ) : (
            <ul className="divide-y divide-cream-300">
              {data.topContributors.map((c, idx) => (
                <li
                  key={c.idcompany || idx}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
                      #{idx + 1}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-ink">{c.name}</p>
                      <p className="text-[11px] text-ink-muted">
                        {c.idcompany}.bantuniaga.app
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-ink">
                    {formatInt(c.records)} records
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </>
  );
}
