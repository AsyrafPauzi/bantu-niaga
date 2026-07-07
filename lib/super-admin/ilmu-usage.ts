import "server-only";

import { creditsToMyr } from "@/lib/settings/credit-pricing";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type IlmuKeySource = "integration" | "env" | "none";

export interface IlmuUsageDashboard {
  keySource: IlmuKeySource;
  integrationEnabled: boolean;
  integrationKeyStored: boolean;
  envKeyConfigured: boolean;
  defaultModel: string;
  invocationsToday: number;
  invocations7d: number;
  invocations30d: number;
  creditsToday: number;
  credits7d: number;
  credits30d: number;
  spendMyrToday: number;
  spendMyr7d: number;
  spendMyr30d: number;
  tokensIn30d: number;
  tokensOut30d: number;
  failureRate30dPct: number;
  daily: Array<{
    day: string;
    label: string;
    invocations: number;
    spendMyr: number;
  }>;
  byAgent: Array<{
    agentSlug: string;
    label: string;
    invocations: number;
    credits: number;
    spendMyr: number;
  }>;
  topTenants: Array<{
    businessId: string;
    name: string;
    invocations: number;
    credits: number;
    spendMyr: number;
  }>;
}

const AGENT_LABELS: Record<string, string> = {
  hr: "Hana (HR)",
  admin: "Amir (Admin)",
  marketing: "Maya (Marketing)",
  finance: "Fayza (Finance)",
  operations: "Aiman (Operations)",
  sales: "Sufi (Sales)",
  boardroom: "Boardroom",
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleString("en-MY", { day: "numeric", month: "short" });
}

function agentLabel(slug: string): string {
  return AGENT_LABELS[slug] ?? slug;
}

function creditsFromSpendCents(spendCents: number): number {
  return Math.round(spendCents / 20);
}

function spendMyrFromCents(spendCents: number): number {
  return Math.round(spendCents) / 100;
}

export function resolveIlmuKeySource(opts: {
  integrationEnabled: boolean;
  integrationKeyStored: boolean;
  envKeyConfigured: boolean;
}): IlmuKeySource {
  if (opts.integrationEnabled && opts.integrationKeyStored) return "integration";
  if (opts.envKeyConfigured) return "env";
  return "none";
}

export async function loadIlmuUsageDashboard(opts: {
  integrationEnabled: boolean;
  integrationKeyStored: boolean;
  defaultModel?: string;
}): Promise<IlmuUsageDashboard> {
  const envKeyConfigured = Boolean(process.env.ILMU_API_KEY?.trim());
  const keySource = resolveIlmuKeySource({
    integrationEnabled: opts.integrationEnabled,
    integrationKeyStored: opts.integrationKeyStored,
    envKeyConfigured,
  });

  const defaultModel =
    opts.defaultModel?.trim() ||
    process.env.ILMU_DEFAULT_MODEL?.trim() ||
    "ilmu-mini-v3.3";

  const now = Date.now();
  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const since7dKey = dayKey(new Date(now - 7 * 86_400_000));
  const since30dKey = dayKey(new Date(now - 30 * 86_400_000));
  const todayKey = dayKey(startToday);

  const svc = createServiceRoleClient();
  const [{ data: dailyRows }, { data: todayRows }] = await Promise.all([
    svc
      .from("ai_agent_usage_daily")
      .select(
        "business_id, agent_slug, day, invocations, spend_cents, tokens_in, tokens_out, failures",
      )
      .gte("day", since30dKey),
    svc
      .from("ai_usage")
      .select(
        "business_id, agent_slug, credits_charged, tokens_in, tokens_out, cost_myr_estimated, metadata, created_at",
      )
      .gte("created_at", startToday.toISOString()),
  ]);

  const dailyBuckets = new Map<string, { invocations: number; spendMyr: number }>();
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(new Date(now - i * 86_400_000));
    dailyBuckets.set(key, { invocations: 0, spendMyr: 0 });
  }

  const byAgent = new Map<
    string,
    { invocations: number; credits: number; spendMyr: number }
  >();
  const byTenant = new Map<
    string,
    { invocations: number; credits: number; spendMyr: number }
  >();

  let invocations30d = 0;
  let credits30d = 0;
  let spendMyr30d = 0;
  let tokensIn30d = 0;
  let tokensOut30d = 0;
  let failures30d = 0;
  let invocations7d = 0;
  let credits7d = 0;
  let spendMyr7d = 0;

  for (const row of dailyRows ?? []) {
    const day = row.day as string;
    if (day >= todayKey) continue;

    const invocations = Number(row.invocations ?? 0);
    const spendCents = Number(row.spend_cents ?? 0);
    const spendMyr = spendMyrFromCents(spendCents);
    const credits = creditsFromSpendCents(spendCents);
    const agentSlug = row.agent_slug as string;
    const businessId = row.business_id as string;
    const failures = Number(row.failures ?? 0);

    invocations30d += invocations;
    credits30d += credits;
    spendMyr30d += spendMyr;
    tokensIn30d += Number(row.tokens_in ?? 0);
    tokensOut30d += Number(row.tokens_out ?? 0);
    failures30d += failures;

    if (day >= since7dKey) {
      invocations7d += invocations;
      credits7d += credits;
      spendMyr7d += spendMyr;
    }

    const bucket = dailyBuckets.get(day);
    if (bucket) {
      bucket.invocations += invocations;
      bucket.spendMyr += spendMyr;
    }

    const agent = byAgent.get(agentSlug) ?? {
      invocations: 0,
      credits: 0,
      spendMyr: 0,
    };
    agent.invocations += invocations;
    agent.credits += credits;
    agent.spendMyr += spendMyr;
    byAgent.set(agentSlug, agent);

    const tenant = byTenant.get(businessId) ?? {
      invocations: 0,
      credits: 0,
      spendMyr: 0,
    };
    tenant.invocations += invocations;
    tenant.credits += credits;
    tenant.spendMyr += spendMyr;
    byTenant.set(businessId, tenant);
  }

  let invocationsToday = 0;
  let creditsToday = 0;
  let spendMyrToday = 0;

  for (const row of todayRows ?? []) {
    const credits = Number(row.credits_charged ?? 0);
    const spend =
      Number(row.cost_myr_estimated ?? 0) > 0
        ? Number(row.cost_myr_estimated)
        : creditsToMyr(credits);
    const agentSlug = row.agent_slug as string;
    const businessId = row.business_id as string;
    const meta = row.metadata as Record<string, unknown> | null;
    const failed =
      meta?.failed === true ||
      (typeof meta?.error === "string" && meta.error.length > 0);

    invocationsToday += 1;
    creditsToday += credits;
    spendMyrToday += spend;
    tokensIn30d += Number(row.tokens_in ?? 0);
    tokensOut30d += Number(row.tokens_out ?? 0);
    if (failed) failures30d += 1;

    const bucket = dailyBuckets.get(todayKey);
    if (bucket) {
      bucket.invocations += 1;
      bucket.spendMyr += spend;
    }

    const agent = byAgent.get(agentSlug) ?? {
      invocations: 0,
      credits: 0,
      spendMyr: 0,
    };
    agent.invocations += 1;
    agent.credits += credits;
    agent.spendMyr += spend;
    byAgent.set(agentSlug, agent);

    const tenant = byTenant.get(businessId) ?? {
      invocations: 0,
      credits: 0,
      spendMyr: 0,
    };
    tenant.invocations += 1;
    tenant.credits += credits;
    tenant.spendMyr += spend;
    byTenant.set(businessId, tenant);
  }

  invocations30d += invocationsToday;
  credits30d += creditsToday;
  spendMyr30d += spendMyrToday;
  invocations7d += invocationsToday;
  credits7d += creditsToday;
  spendMyr7d += spendMyrToday;

  const tenantIds = Array.from(byTenant.keys());
  const { data: businesses } =
    tenantIds.length > 0
      ? await svc.from("businesses").select("id, name").in("id", tenantIds)
      : { data: [] };
  const bizNames = new Map(
    (businesses ?? []).map((b) => [b.id as string, b.name as string]),
  );

  const daily = Array.from(dailyBuckets.entries()).map(([day, v]) => ({
    day,
    label: dayLabel(day),
    invocations: v.invocations,
    spendMyr: Math.round(v.spendMyr * 100) / 100,
  }));

  const byAgentRows = Array.from(byAgent.entries())
    .map(([agentSlug, v]) => ({
      agentSlug,
      label: agentLabel(agentSlug),
      invocations: v.invocations,
      credits: v.credits,
      spendMyr: Math.round(v.spendMyr * 100) / 100,
    }))
    .sort((a, b) => b.invocations - a.invocations);

  const topTenants = Array.from(byTenant.entries())
    .map(([businessId, v]) => ({
      businessId,
      name: bizNames.get(businessId) ?? businessId.slice(0, 8),
      invocations: v.invocations,
      credits: v.credits,
      spendMyr: Math.round(v.spendMyr * 100) / 100,
    }))
    .sort((a, b) => b.spendMyr - a.spendMyr);

  return {
    keySource,
    integrationEnabled: opts.integrationEnabled,
    integrationKeyStored: opts.integrationKeyStored,
    envKeyConfigured,
    defaultModel,
    invocationsToday,
    invocations7d,
    invocations30d,
    creditsToday,
    credits7d,
    credits30d,
    spendMyrToday: Math.round(spendMyrToday * 100) / 100,
    spendMyr7d: Math.round(spendMyr7d * 100) / 100,
    spendMyr30d: Math.round(spendMyr30d * 100) / 100,
    tokensIn30d,
    tokensOut30d,
    failureRate30dPct:
      invocations30d > 0
        ? Math.round((failures30d / invocations30d) * 1000) / 10
        : 0,
    daily,
    byAgent: byAgentRows,
    topTenants,
  };
}
