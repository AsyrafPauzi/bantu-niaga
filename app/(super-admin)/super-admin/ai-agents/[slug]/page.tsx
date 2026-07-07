import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  HelpCircle,
  Package,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { loadAgentDetail } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import { Sparkline } from "@/components/super-admin/Sparkline";
import { AgentScopeEditor } from "@/components/super-admin/AgentScopeEditor";
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

export default async function AgentDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail;
  try {
    detail = await loadAgentDetail(slug);
  } catch {
    notFound();
  }
  const { agent, version, usage } = detail;
  const Icon = ICONS[agent.icon] ?? Sparkles;

  return (
    <>
      <PageTopbar
        title={
          <span className="inline-flex items-center gap-2.5">
            <Link
              href="/super-admin/ai-agents"
              className="grid h-7 w-7 place-items-center rounded-md border border-cream-300 bg-white text-ink-muted hover:bg-cream-100"
              aria-label="Back to agents"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-100 text-brand-700">
              <Icon className="h-4 w-4" />
            </span>
            <span>{agent.name}</span>
            <StatusPill
              tone={
                agent.status === "active"
                  ? "success"
                  : agent.status === "beta"
                    ? "info"
                    : "muted"
              }
              label={
                agent.status === "active"
                  ? "Active"
                  : agent.status === "beta"
                    ? "Beta"
                    : "Disabled"
              }
            />
          </span>
        }
        subtitle={`${agent.short_desc} · ${PILLAR_LABEL[agent.pillar as Pillar] ?? agent.pillar} · ${agent.default_model}`}
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Invocations / 7d"
            value={formatInt(usage.invocations)}
            delta="rolling"
            trend="up"
          />
          <KpiCard
            label="Spend / 7d"
            value={formatMyr(usage.spend_myr)}
            delta="tokens + tools"
          />
          <KpiCard
            label="Avg latency"
            value={`${usage.avg_latency_ms} ms`}
            subtle="p50"
          />
          <KpiCard
            label="Failure rate"
            value={`${usage.failure_rate_pct}%`}
            subtle={usage.failure_rate_pct > 5 ? "needs attention" : "healthy"}
            trend={usage.failure_rate_pct > 5 ? "down" : "flat"}
          />
        </div>

        <div className="rounded-xl border border-cream-300 bg-white p-5 shadow-card text-brand-500">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Activity</h2>
              <p className="text-xs text-ink-muted">
                Daily invocations across all tenants. Live data from
                ai_agent_usage_daily.
              </p>
            </div>
            <span className="rounded-md bg-cream-100 px-2 py-1 text-[10px] font-bold text-ink-muted">
              v{version?.version_label ?? "unpublished"}
            </span>
          </div>
          <Sparkline values={usage.hourly} height={80} width={1000} />
        </div>

        <AgentScopeEditor slug={slug} version={version} />
      </PageBody>
    </>
  );
}
