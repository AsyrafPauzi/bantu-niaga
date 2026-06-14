import { Calendar, Download, Megaphone, ArrowRight } from "lucide-react";
import { loadOverview } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverview() {
  const { kpis, planMix, weeklyGrowth, activity } = await loadOverview();

  const maxBar = Math.max(1, ...weeklyGrowth.map((w) => w.count));

  const services = [
    { name: "Web app (Vercel)", status: "Operational", uptime: "99.99%", tone: "success" as const },
    { name: "Database (Supabase)", status: "Operational", uptime: "99.97%", tone: "success" as const },
    { name: "Object storage", status: "Operational", uptime: "100%", tone: "success" as const },
    { name: "AI gateway (OpenAI)", status: "Degraded", uptime: "98.21%", tone: "warning" as const },
    { name: "Payments (Billplz)", status: "Operational", uptime: "99.90%", tone: "success" as const },
  ];

  return (
    <>
      <PageTopbar
        title="Platform overview"
        subtitle={`All tenants · ${kpis.activeTenants} paid · ${kpis.trialTenants} trial`}
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-cream-200 px-3 py-1.5 text-xs font-semibold text-ink">
              <Calendar className="h-3.5 w-3.5" />
              Last 30 days
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <Megaphone className="h-3.5 w-3.5" />
              Broadcast
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Active tenants"
            value={formatInt(kpis.activeTenants)}
            delta={`+${weeklyGrowth.at(-1)?.count ?? 0} this week`}
            subtle={`${kpis.trialTenants} on trial`}
          />
          <KpiCard
            label="Monthly recurring revenue"
            value={formatMyr(kpis.mrrMyr)}
            delta="Live"
            subtle={`${formatMyr(kpis.mrrMyr * 12)} ARR forecast`}
          />
          <KpiCard
            label="Active users (30d)"
            value={formatInt(kpis.activeUsers30d)}
            delta={`Avg ${
              kpis.activeTenants > 0
                ? Math.round(kpis.activeUsers30d / Math.max(1, kpis.activeTenants))
                : 0
            } / tenant`}
          />
          <KpiCard
            label="AI invocations (24h)"
            value={formatInt(kpis.aiInvocations24h)}
            delta={`RM ${(kpis.aiSpendCents24h / 100).toFixed(2)} spend`}
          />
        </div>

        <div className="flex gap-5 flex-wrap items-start">
          <Section
            className="flex-1 min-w-[480px]"
            title="Tenant growth"
            description="New sign-ups per week · Last 12 weeks"
            right={
              <div className="flex rounded-lg bg-cream-200 p-1">
                {["Tenants", "MRR", "Users"].map((t, i) => (
                  <span
                    key={t}
                    className={`px-3 py-1 text-xs font-semibold ${
                      i === 0
                        ? "rounded-md bg-white text-ink"
                        : "text-ink-muted"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            }
          >
            <div className="flex items-end gap-3 h-56 px-1">
              {weeklyGrowth.map((w, i) => (
                <div
                  key={w.weekLabel + i}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-full rounded-md ${
                      i === weeklyGrowth.length - 1
                        ? "bg-brand-500"
                        : "bg-brand-300"
                    }`}
                    style={{
                      height: `${Math.max(8, (w.count / maxBar) * 200)}px`,
                    }}
                  />
                  <span className="text-[10px] text-ink-muted">
                    {w.weekLabel}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            className="w-[360px]"
            title="Plan mix"
            description={`${kpis.activeTenants + kpis.trialTenants} tenants total`}
          >
            <div className="space-y-3.5">
              {planMix.map((p) => {
                const share = Math.round(
                  (p.count / Math.max(1, kpis.activeTenants + kpis.trialTenants)) *
                    100,
                );
                return (
                  <div key={p.tier} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        {p.label}
                      </span>
                      <span className="text-xs text-ink-muted">
                        <span className="font-bold text-ink">{p.count}</span>{" "}
                        · {share}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
                      <div
                        className={`h-full ${
                          p.tier === "starter"
                            ? "bg-cream-400"
                            : p.tier === "micro"
                              ? "bg-brand-300"
                              : p.tier === "sme"
                                ? "bg-brand-500"
                                : "bg-accent-500"
                        }`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="flex gap-5 flex-wrap items-start">
          <Section
            className="flex-1 min-w-[520px]"
            title="Recent platform activity"
            right={
              <a
                href="/super-admin/audit"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-600"
              >
                Open audit log
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            }
          >
            {activity.length === 0 ? (
              <p className="text-sm text-ink-muted py-4">
                No recent platform activity yet — activity will appear here as
                tenants do things.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-cream-100"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50">
                      <span className="text-xs font-bold text-brand-700">
                        {row.icon[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {row.title}
                      </p>
                      <p className="text-xs text-ink-muted truncate">
                        {row.subtitle}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-ink-subtle shrink-0">
                      {row.whenLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            className="w-[360px]"
            title="System health"
            description="All services nominal · 7-day uptime"
          >
            <div className="space-y-2">
              {services.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-lg bg-cream-100 px-3 py-2.5"
                >
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-ink">{s.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      Uptime {s.uptime}
                    </p>
                  </div>
                  <StatusPill tone={s.tone} label={s.status} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
