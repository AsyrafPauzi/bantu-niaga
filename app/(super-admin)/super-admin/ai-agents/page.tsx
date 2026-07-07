import Link from "next/link";
import {
  Brain,
  HelpCircle,
  Package,
  Plus,
  Settings2,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { loadAgents } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import { Sparkline } from "@/components/super-admin/Sparkline";
import { PILLAR_LABEL, type Pillar } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  package: Package,
  wallet: Wallet,
  "brain-circuit": Brain,
  users: Users,
  "help-circle": HelpCircle,
};

function statusToPill(s: "active" | "beta" | "disabled") {
  if (s === "active") return <StatusPill tone="success" label="Active" />;
  if (s === "beta") return <StatusPill tone="info" label="Beta" />;
  return <StatusPill tone="muted" label="Disabled" />;
}

export default async function SuperAdminAgents() {
  const items = await loadAgents();

  const totalInvocations = items.reduce(
    (s, x) => s + x.usage.invocations,
    0,
  );
  const totalSpend = items.reduce((s, x) => s + x.usage.spend_myr, 0);
  const avgLatency = items.length
    ? Math.round(
        items.reduce((s, x) => s + x.usage.avg_latency_ms, 0) /
          Math.max(1, items.length),
      )
    : 0;
  const worstFailure = items.reduce(
    (m, x) => Math.max(m, x.usage.failure_rate_pct),
    0,
  );

  return (
    <>
      <PageTopbar
        title="AI Agents"
        subtitle={`${items.length} agents · ${formatInt(totalInvocations)} invocations · last 7 days`}
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Settings2 className="h-3.5 w-3.5" />
              Global guardrails
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <Plus className="h-3.5 w-3.5" />
              New agent
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Invocations / 7d"
            value={formatInt(totalInvocations)}
            delta="rolling"
            trend="up"
          />
          <KpiCard
            label="Spend / 7d"
            value={formatMyr(totalSpend)}
            delta="includes tokens + tools"
            trend="up"
          />
          <KpiCard
            label="Avg latency"
            value={`${avgLatency} ms`}
            subtle="p50 across agents"
          />
          <KpiCard
            label="Worst failure rate"
            value={`${worstFailure}%`}
            subtle={worstFailure > 5 ? "needs attention" : "all healthy"}
            trend={worstFailure > 5 ? "down" : "flat"}
          />
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}
        >
          {items.map(({ agent, usage }) => {
            const Icon = ICONS[agent.icon] ?? Sparkles;
            return (
              <Link
                href={`/super-admin/ai-agents/${agent.slug}`}
                key={agent.id}
                className="group block overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card transition hover:border-brand-300 hover:shadow-elevated"
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-bold text-ink">
                        {agent.name}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {agent.short_desc}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {PILLAR_LABEL[agent.pillar as Pillar] ?? agent.pillar}
                        {" · "}
                        {agent.default_model}
                      </p>
                    </div>
                  </div>
                  {statusToPill(agent.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-cream-300 bg-cream-100 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Invocations
                    </p>
                    <p className="text-sm font-bold text-ink">
                      {formatInt(usage.invocations)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Latency
                    </p>
                    <p className="text-sm font-bold text-ink">
                      {usage.avg_latency_ms}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Failure
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        usage.failure_rate_pct > 5
                          ? "text-status-warning"
                          : "text-status-success"
                      }`}
                    >
                      {usage.failure_rate_pct}%
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 text-brand-500">
                  <Sparkline values={usage.hourly} label="7d activity" />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-ink-muted">
                    <span>7d activity</span>
                    <span className="group-hover:text-brand-700">
                      Configure scope →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
