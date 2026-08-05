import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  HelpCircle,
  LineChart,
  Package,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { loadAgentDetail } from "@/lib/super-admin/load";
import { loadNadiaSettings } from "@/lib/super-admin/nadia-load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import { Sparkline } from "@/components/super-admin/Sparkline";
import { AgentScopeEditor } from "@/components/super-admin/AgentScopeEditor";
import { NadiaReplySettings } from "@/components/super-admin/analyst/NadiaReplySettings";
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

export default async function AgentDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail;
  let nadiaSettings = null;
  try {
    detail = await loadAgentDetail(slug);
    if (slug === "nadia") {
      nadiaSettings = await loadNadiaSettings();
    }
  } catch {
    notFound();
  }
  const { agent, version, usage, scopeConfigured } = detail;
  const Icon = ICONS[agent.icon] ?? Sparkles;
  const pillar =
    PILLAR_LABEL[agent.pillar as Pillar] ??
    agent.pillar.charAt(0).toUpperCase() + agent.pillar.slice(1);
  const sparkMax = Math.max(...usage.hourly, 0);
  const usageSource =
    slug === "boardroom" ? "credit_ledger" : "ai_usage + daily rollup";
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
        subtitle={`${agent.short_desc} · ${pillar} · ${agent.default_model}`}
      />

      <PageBody>
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            What controls accuracy &amp; tone today
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-muted dark:text-cream-400">
            <li>
              <strong className="text-ink dark:text-cream-200">Live data packet</strong>{" "}
              — tenant briefing + tools (numbers must come from here; stops
              invented RM / invoice #).
            </li>
            <li>
              <strong className="text-ink dark:text-cream-200">Tenant display name</strong>{" "}
              — each business can set a custom name (default Maya, Fayza, …);
              runtime prepends &quot;You are {"{name}"}, the Marketing staff
              AI…&quot; on every request.
            </li>
            <li>
              <strong className="text-ink dark:text-cream-200">Scope below (live)</strong>{" "}
              — published role rules, guardrails, allowed actions. Avoid
              hardcoded names in the system prompt.
            </li>
            {slug === "boardroom" ? (
              <li>
                <strong className="text-ink dark:text-cream-200">Boardroom roles</strong>{" "}
                — per-agent templates in{" "}
                <code className="rounded bg-white/80 px-1 py-0.5 text-[10px] dark:bg-panel-dark">
                  BOARDROOM_ROLE_PROMPTS
                </code>{" "}
                (Fayza, Aiman, Maya, …) plus structured JSON output.
              </li>
            ) : null}
          </ul>
        </div>

        <Section
          title="Usage (last 7 days)"
          description={`Billing monitor only — ${usageSource}. Does not change how the model behaves.`}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Invocations"
              value={formatInt(usage.invocations)}
              subtle={usage.invocations > 0 ? usageSource : "no usage yet"}
            />
            <KpiCard
              label="Credits"
              value={formatInt(usage.credits)}
              subtle="tenant pool"
            />
            <KpiCard
              label="Spend"
              value={formatMyr(usage.spend_myr)}
              subtle="retail estimate"
            />
          </div>

          {sparkMax > 0 ? (
            <div className="mt-4 w-full min-w-0 overflow-hidden rounded-lg border border-cream-300 bg-cream-50/50 p-3 text-brand-500 dark:border-hairline-dark dark:bg-panel-dark/40">
              <div className="w-full min-w-0">
                <Sparkline
                  values={usage.hourly}
                  height={72}
                  width={320}
                  responsive
                  label="7 day activity"
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">
              No activity this week for {agent.name}.
            </p>
          )}
        </Section>

        {slug === "nadia" && nadiaSettings ? (
          <Section
            title="Reply channels"
            description="How Nadia responds on the Revenue dashboard — text, voice, or both."
          >
            <NadiaReplySettings initialSettings={nadiaSettings} />
          </Section>
        ) : null}

        <Section
          title="Agent behavior"
          description={
            scopeConfigured
              ? `Published scope ${version?.version_label ?? ""} — system prompt, guardrails, allowed actions.`
              : "No published scope yet — using code defaults until you save & publish below."
          }
        >
          <AgentScopeEditor slug={slug} version={version} />
        </Section>
      </PageBody>
    </>
  );
}
