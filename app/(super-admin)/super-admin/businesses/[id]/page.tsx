import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HealthBandPill } from "@/components/super-admin/HealthBandPill";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  PageBody,
  Section,
  StatusPill,
} from "@/components/super-admin/primitives";
import {
  TenantAgentRoutingEditor,
  type TenantAgentSettingRow,
} from "@/components/super-admin/TenantAgentRoutingEditor";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tierBy } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

export default async function SuperAdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const svc = createServiceRoleClient();

  const [{ data: biz }, { data: health }, { data: settings }] = await Promise.all([
    svc
      .from("businesses")
      .select(
        "id, idcompany, name, tier, subscription_status, credit_balance, state_code, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    svc
      .from("tenant_health_snapshots")
      .select("score, band, signals, computed_at")
      .eq("business_id", id)
      .maybeSingle(),
    svc
      .from("business_agent_settings")
      .select(
        "agent_slug, display_name, assistant_enabled, reasoning_mode, model_override",
      )
      .eq("business_id", id)
      .order("agent_slug"),
  ]);

  if (!biz) notFound();

  const agentSettings = (settings ?? []) as TenantAgentSettingRow[];

  return (
    <>
      <PageTopbar
        title={biz.name}
        subtitle={`${biz.idcompany} · ${tierBy(biz.tier)?.label ?? biz.tier}`}
        right={
          <Link
            href="/super-admin/businesses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All businesses
          </Link>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Stat label="Subscription" value={<StatusPill tone="info" label={biz.subscription_status} />} />
          <Stat label="Credits" value={String(biz.credit_balance ?? 0)} />
          <Stat label="State" value={biz.state_code ?? "—"} />
          <Stat
            label="Health"
            value={
              health ? (
                <HealthBandPill
                  band={health.band as "healthy" | "watch" | "at_risk" | "critical"}
                  score={health.score as number}
                />
              ) : (
                "Not scored"
              )
            }
          />
        </div>

        <Section
          title="AI model routing"
          description="Override reasoning mode or force a specific model for this tenant. Tenant owners still see their Settings UI; admin override wins at runtime."
        >
          <TenantAgentRoutingEditor
            businessId={biz.id}
            initialSettings={agentSettings}
          />
        </Section>

        {health?.signals ? (
          <Section title="Health signals" description={`Last computed ${new Date(health.computed_at as string).toLocaleString("en-MY")}`}>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(health.signals as Record<string, unknown>).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2"
                  >
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">
                      {String(value)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </Section>
        ) : null}
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <div className="mt-2 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}
