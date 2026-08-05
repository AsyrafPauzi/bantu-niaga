import Link from "next/link";
import {
  Brain,
  HelpCircle,
  LineChart,
  Package,
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
  "line-chart": LineChart,
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
  const totalCredits = items.reduce((s, x) => s + x.usage.credits, 0);
  const totalSpend = items.reduce((s, x) => s + x.usage.spend_myr, 0);
  const activeAgents = items.filter((x) => x.usage.invocations > 0).length;
  const hasUsage = totalInvocations > 0;

  return (
    <>
      <PageTopbar
        title="AI Agents"
        subtitle={`${items.length} agents · tenant copilots + platform analyst`}
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Invocations / 7d"
            value={formatInt(totalInvocations)}
            subtle={hasUsage ? "all tenants" : "no usage yet"}
            trend="flat"
          />
          <KpiCard
            label="Credits / 7d"
            value={formatInt(totalCredits)}
            subtle="tenant credit pool"
            trend="flat"
          />
          <KpiCard
            label="Spend / 7d"
            value={formatMyr(totalSpend)}
            subtle="estimated retail value"
            trend="flat"
          />
          <KpiCard
            label="Agents in use"
            value={formatInt(activeAgents)}
            subtle={`of ${items.length} configured`}
            trend={activeAgents > 0 ? "up" : "flat"}
          />
        </div>

        {!hasUsage ? (
          <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50/60 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-ink">
              No AI usage in the last 7 days
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Numbers appear here when tenants chat with assistants or run
              Boardroom meetings. Check the ILMU monitor for provider-level
              detail.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          {items.map(({ agent, usage, scopeConfigured }) => {
            const Icon = ICONS[agent.icon] ?? Sparkles;
            const pillar =
              PILLAR_LABEL[agent.pillar as Pillar] ??
              agent.pillar.charAt(0).toUpperCase() + agent.pillar.slice(1);
            const sparkMax = Math.max(...usage.hourly, 0);

            return (
              <Link
                href={`/super-admin/ai-agents/${agent.slug}`}
                key={agent.slug}
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
                        {pillar}
                        {" · "}
                        {agent.default_model}
                        {!scopeConfigured ? " · scope draft" : ""}
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
                      Credits
                    </p>
                    <p className="text-sm font-bold text-ink">
                      {formatInt(usage.credits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      Spend
                    </p>
                    <p className="text-sm font-bold text-ink">
                      {formatMyr(usage.spend_myr)}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 text-brand-500">
                  <Sparkline values={usage.hourly} label="7d activity" />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-ink-muted">
                    <span>
                      {sparkMax > 0 ? "7d activity" : "No activity this week"}
                    </span>
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
