"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkline } from "@/components/super-admin/Sparkline";
import { Section, formatMyr } from "@/components/super-admin/primitives";
import { useChartMount } from "@/components/marketing/dashboard/use-chart-mount";
import type { RevenueDashboard } from "@/lib/super-admin/revenue";
import { cn } from "@/lib/utils/cn";

const CHART_COLORS = {
  subscription: "#2d6a4f",
  addon: "#40916c",
  topup: "#52b788",
  manual: "#95d5b2",
  plans: "#1b4332",
  addons: "#74c69d",
};

function KpiSparkCard({
  label,
  value,
  delta,
  subtle,
  sparkline,
  trend,
}: {
  label: string;
  value: string;
  delta?: string;
  subtle?: string;
  sparkline?: number[];
  trend?: "up" | "down" | "flat";
}) {
  const trendColor =
    trend === "up"
      ? "text-status-success"
      : trend === "down"
        ? "text-status-danger"
        : "text-ink-muted";

  return (
    <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {delta ? (
        <p className={cn("mt-1 text-xs font-semibold", trendColor)}>{delta}</p>
      ) : null}
      {subtle ? (
        <p className="mt-0.5 text-[11px] text-ink-muted">{subtle}</p>
      ) : null}
      {sparkline && sparkline.some((v) => v > 0) ? (
        <div className="mt-3 text-brand-600">
          <Sparkline values={sparkline} height={32} responsive width={200} />
        </div>
      ) : null}
    </div>
  );
}

function ChartPlaceholder({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-cream-100"
      style={{ height }}
    />
  );
}

export function RevenueDashboardClient({
  revenue,
  tenantPage,
  tenantPageSize,
  tenantTotal,
}: {
  revenue: RevenueDashboard;
  tenantPage: number;
  tenantPageSize: number;
  tenantTotal: number;
}) {
  const mounted = useChartMount();
  const arr = revenue.mrrTotalMyr * 12;

  const areaData = revenue.monthly.map((m) => ({
    name: m.label,
    Subscriptions: m.subscriptionMyr,
    Addons: m.addonMyr,
    Topups: m.topupMyr,
    Other: m.manualMyr,
    total: m.totalMyr,
  }));

  const mrrDonut = [
    { name: "Plans", value: revenue.mrrSubscriptionMyr, color: CHART_COLORS.plans },
    { name: "Add-ons", value: revenue.mrrAddonMyr, color: CHART_COLORS.addons },
  ].filter((d) => d.value > 0);

  const planBar = revenue.planRevenue.filter(
    (p) => p.tier !== "starter" && p.count > 0,
  );

  const growthTrend =
    revenue.mrrGrowthPct == null
      ? "flat"
      : revenue.mrrGrowthPct >= 0
        ? "up"
        : "down";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiSparkCard
          label="Total MRR"
          value={formatMyr(revenue.mrrTotalMyr)}
          delta={`${formatMyr(revenue.mrrSubscriptionMyr)} plans · ${formatMyr(revenue.mrrAddonMyr)} add-ons`}
          subtle={`ARR projection ${formatMyr(arr)}`}
          sparkline={revenue.mrrSparkline}
        />
        <KpiSparkCard
          label="Net new (month)"
          value={formatMyr(revenue.netNewMrrMyr)}
          delta={
            revenue.mrrGrowthPct != null
              ? `${revenue.mrrGrowthPct >= 0 ? "+" : ""}${revenue.mrrGrowthPct}% vs prior month`
              : "No prior month data"
          }
          trend={growthTrend}
        />
        <KpiSparkCard
          label="Collected (30d)"
          value={formatMyr(revenue.collectedLast30dMyr)}
          subtle={`90d: ${formatMyr(revenue.collectedLast90dMyr)} · ${revenue.paidInvoiceCount} paid`}
        />
        <KpiSparkCard
          label="Pending invoices"
          value={formatMyr(revenue.pendingInvoicesMyr)}
          delta={`${revenue.pendingInvoiceCount} open`}
          trend={revenue.pendingInvoicesMyr > 0 ? "down" : "flat"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-cream-300 bg-cream-50/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            ARPU
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatMyr(revenue.arpuMyr)}
          </p>
          <p className="text-[11px] text-ink-muted">
            {revenue.payingTenantCount} paying tenants
          </p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-cream-50/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            AI cost (30d)
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {formatMyr(revenue.aiCost30dMyr)}
          </p>
          <p className="text-[11px] text-ink-muted">Platform ILMU usage</p>
        </div>
        <div className="rounded-xl border border-cream-300 bg-cream-50/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Gross margin (30d)
          </p>
          <p className="mt-1 text-lg font-bold text-ink">
            {revenue.grossMarginPct != null
              ? `${revenue.grossMarginPct}%`
              : "—"}
          </p>
          <p className="text-[11px] text-ink-muted">
            Collected minus AI cost
          </p>
        </div>
      </div>

      <Section
        title="Monthly collected revenue"
        description="Paid platform invoices over the last 12 months, stacked by type."
      >
        {mounted ? (
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.subscription} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={CHART_COLORS.subscription} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `RM${v}`} />
                <Tooltip
                  formatter={(value) => formatMyr(Number(value))}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8e4dc" }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Subscriptions"
                  stackId="1"
                  stroke={CHART_COLORS.subscription}
                  fill="url(#subGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="Addons"
                  stackId="1"
                  stroke={CHART_COLORS.addon}
                  fill={CHART_COLORS.addon}
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="Topups"
                  stackId="1"
                  stroke={CHART_COLORS.topup}
                  fill={CHART_COLORS.topup}
                  fillOpacity={0.5}
                />
                <Area
                  type="monotone"
                  dataKey="Other"
                  stackId="1"
                  stroke={CHART_COLORS.manual}
                  fill={CHART_COLORS.manual}
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartPlaceholder height={300} />
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="MRR composition" description="Recurring plans vs active add-ons.">
          {mounted && mrrDonut.length > 0 ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-[220px] w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mrrDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {mrrDonut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMyr(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2 text-sm">
                {mrrDonut.map((d) => (
                  <li key={d.name} className="flex justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: d.color }}
                      />
                      {d.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMyr(d.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No recurring revenue yet.</p>
          )}
        </Section>

        <Section title="Revenue by plan" description="Paying tenants per tier.">
          {mounted && planBar.length > 0 ? (
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planBar} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8e4dc" />
                  <XAxis type="number" tickFormatter={(v) => `RM${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatMyr(Number(v))} />
                  <Bar dataKey="mrrMyr" fill={CHART_COLORS.plans} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No paid plans yet.</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Add-on MRR" description="Marketplace add-ons contributing to MRR.">
          {revenue.addonMrrBySlug.length === 0 ? (
            <p className="text-sm text-ink-muted">No active add-ons.</p>
          ) : (
            <ul className="space-y-2">
              {revenue.addonMrrBySlug.slice(0, 8).map((a) => (
                <li
                  key={a.slug}
                  className="flex items-center justify-between rounded-lg border border-cream-300 bg-cream-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{a.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {a.tenantCount} tenant{a.tenantCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-brand-700">
                    {formatMyr(a.mrrMyr)}/mo
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Top paying tenants"
          description="Collected invoice totals (last 12 months)."
        >
          {revenue.topTenants.length === 0 ? (
            <p className="text-sm text-ink-muted">No data yet.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {revenue.topTenants
                  .slice(
                    (tenantPage - 1) * tenantPageSize,
                    tenantPage * tenantPageSize,
                  )
                  .map((t) => (
                    <li key={t.businessId}>
                      <Link
                        href={`/super-admin/businesses/${t.businessId}`}
                        className="flex items-center justify-between rounded-lg border border-cream-300 bg-white px-3 py-2 hover:bg-cream-50"
                      >
                        <span className="text-sm font-medium text-ink">
                          {t.name}
                        </span>
                        <span className="text-sm font-bold text-brand-700">
                          {formatMyr(t.amountMyr)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
              {tenantTotal > tenantPageSize ? (
                <p className="mt-2 text-center text-[11px] text-ink-muted">
                  Page {tenantPage} · {tenantTotal} tenants
                </p>
              ) : null}
            </>
          )}
        </Section>
      </div>

      <Section title="By invoice type" description="Last 12 months paid totals.">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {revenue.byKind.length === 0 ? (
            <li className="text-sm text-ink-muted">No paid invoices yet.</li>
          ) : (
            revenue.byKind.map((row) => (
              <li
                key={row.kind}
                className="flex items-center justify-between rounded-lg border border-cream-300 bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-ink">{row.label}</span>
                <span className="text-sm font-bold text-ink">
                  {formatMyr(row.amountMyr)}{" "}
                  <span className="font-normal text-ink-muted">· {row.count}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </Section>
    </div>
  );
}
