import "server-only";

import {
  TENANT_AI_AGENTS,
  type TenantAgentDefinition,
} from "@/lib/settings/ai-agents-catalog";
import { creditsToMyr } from "@/lib/settings/credit-pricing";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  PLATFORM_AI_AGENTS,
  type PlatformAgentDefinition,
} from "@/lib/super-admin/platform-agents-catalog";
import type { AgentUsage7d, AiAgentRow, AiAgentVersion } from "./types";

export type PlatformAgentListItem = {
  agent: AiAgentRow;
  usage: AgentUsage7d;
  /** True when a published scope exists in ai_agent_versions. */
  scopeConfigured: boolean;
};

export const BOARDROOM_LEDGER_PREFIX = "boardroom.";

type UsageRow = {
  agent_slug: string;
  credits_charged: number | null;
  cost_myr_estimated: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DailyRollupRow = {
  agent_slug: string;
  day: string;
  invocations: number | null;
  spend_cents: number | null;
  failures: number | null;
};

type AgentStatsBucket = {
  invocations: number;
  credits: number;
  spend_myr: number;
  failures: number;
  daily: Array<{ day: string; invocations: number }>;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isFailed(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) return false;
  return (
    metadata.failed === true ||
    (typeof metadata.error === "string" && metadata.error.length > 0)
  );
}

function spendMyrFromRow(row: UsageRow): number {
  const estimated = Number(row.cost_myr_estimated ?? 0);
  if (estimated > 0) return estimated;
  return creditsToMyr(Number(row.credits_charged ?? 0));
}

function emptyStatsBucket(): AgentStatsBucket {
  return {
    invocations: 0,
    credits: 0,
    spend_myr: 0,
    failures: 0,
    daily: [],
  };
}

export function buildDailySparkline(
  rows: Array<{ day: string; invocations: number }>,
  days = 7,
): number[] {
  const now = Date.now();
  const keys: string[] = [];
  const totals = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * 86_400_000));
    keys.push(key);
    totals.set(key, 0);
  }
  for (const row of rows) {
    if (totals.has(row.day)) {
      totals.set(row.day, (totals.get(row.day) ?? 0) + row.invocations);
    }
  }
  return keys.map((key) => totals.get(key) ?? 0);
}

/** Boardroom spend is logged in credit_ledger (not ai_usage) until each speak is recorded. */
export function aggregateBoardroomLedgerRows(
  rows: Array<{ delta: number; created_at: string }>,
): AgentStatsBucket {
  const bucket = emptyStatsBucket();

  for (const row of rows) {
    const credits = Math.abs(Number(row.delta ?? 0));
    if (credits <= 0) continue;

    bucket.invocations += 1;
    bucket.credits += credits;
    bucket.spend_myr += creditsToMyr(credits);

    const day = row.created_at.slice(0, 10);
    const existing = bucket.daily.find((d) => d.day === day);
    if (existing) {
      existing.invocations += 1;
    } else {
      bucket.daily.push({ day, invocations: 1 });
    }
  }

  return bucket;
}

export function tenantAgentToRow(def: TenantAgentDefinition): AiAgentRow {
  const iconBySlug: Record<string, string> = {
    marketing: "sparkles",
    finance: "wallet",
    operations: "package",
    sales: "sparkles",
    hr: "users",
    admin: "help-circle",
    boardroom: "brain-circuit",
  };
  return {
    id: def.slug,
    slug: def.slug,
    name: def.defaultName,
    short_desc: def.roleTitle,
    pillar: def.pillar.toLowerCase(),
    icon: iconBySlug[def.slug] ?? "sparkles",
    default_model: def.slug === "boardroom" ? "nemo-super" : "ilmu-mini-v3.3",
    status: "active",
    published_version_id: null,
    updated_at: new Date().toISOString(),
  };
}

export function mergeAgentCatalogRow(
  def: TenantAgentDefinition,
  dbRow: AiAgentRow | undefined,
): AiAgentRow {
  const base = tenantAgentToRow(def);
  if (!dbRow) return base;
  return {
    ...base,
    id: dbRow.id,
    name: dbRow.name?.trim() || base.name,
    short_desc: dbRow.short_desc?.trim() || base.short_desc,
    pillar: dbRow.pillar || base.pillar,
    icon: dbRow.icon || base.icon,
    default_model: dbRow.default_model || base.default_model,
    status: dbRow.status,
    published_version_id: dbRow.published_version_id,
    updated_at: dbRow.updated_at,
    settings: dbRow.settings,
  };
}

export function platformAgentToRow(def: PlatformAgentDefinition): AiAgentRow {
  return {
    id: def.slug,
    slug: def.slug,
    name: def.defaultName,
    short_desc: def.roleTitle,
    pillar: def.pillar,
    icon: def.icon,
    default_model: def.defaultModel,
    status: "active",
    published_version_id: null,
    updated_at: new Date().toISOString(),
  };
}

export function mergePlatformAgentRow(
  def: PlatformAgentDefinition,
  dbRow: AiAgentRow | undefined,
): AiAgentRow {
  const base = platformAgentToRow(def);
  if (!dbRow) return base;
  return {
    ...base,
    id: dbRow.id,
    name: dbRow.name?.trim() || base.name,
    short_desc: dbRow.short_desc?.trim() || base.short_desc,
    pillar: dbRow.pillar || base.pillar,
    icon: dbRow.icon || base.icon,
    default_model: dbRow.default_model || base.default_model,
    status: dbRow.status,
    published_version_id: dbRow.published_version_id,
    updated_at: dbRow.updated_at,
    settings: dbRow.settings,
  };
}

function buildAgentListItem(
  def: TenantAgentDefinition | PlatformAgentDefinition,
  dbRow: AiAgentRow | undefined,
  stats: Map<string, AgentStatsBucket>,
  isPlatform: boolean,
): PlatformAgentListItem {
  const agent = isPlatform
    ? mergePlatformAgentRow(def as PlatformAgentDefinition, dbRow)
    : mergeAgentCatalogRow(def as TenantAgentDefinition, dbRow);
  const u = stats.get(def.slug);
  const invocations = u?.invocations ?? 0;
  const usage: AgentUsage7d = {
    agent_slug: def.slug,
    invocations,
    credits: u?.credits ?? 0,
    spend_myr: Math.round((u?.spend_myr ?? 0) * 100) / 100,
    failure_rate_pct:
      invocations > 0
        ? Math.round(((u?.failures ?? 0) / invocations) * 1000) / 10
        : null,
    hourly: buildDailySparkline(u?.daily ?? []),
  };
  return {
    agent,
    usage,
    scopeConfigured: Boolean(dbRow?.published_version_id),
  };
}

export async function loadPlatformAgentsDashboard(): Promise<
  PlatformAgentListItem[]
> {
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const since7dKey = dayKey(since7d);
  const todayKey = dayKey(new Date());

  const svc = createServiceRoleClient();
  const [
    { data: usageRows },
    { data: dailyRows },
    { data: dbAgents },
    { data: boardroomLedger },
  ] = await Promise.all([
    svc
      .from("ai_usage")
      .select(
        "agent_slug, credits_charged, cost_myr_estimated, metadata, created_at",
      )
      .gte("created_at", since7d.toISOString()),
    svc
      .from("ai_agent_usage_daily")
      .select("agent_slug, day, invocations, spend_cents, failures")
      .gte("day", since7dKey)
      .lt("day", todayKey),
    svc
      .from("ai_agents")
      .select(
        "id, slug, name, short_desc, pillar, icon, default_model, status, published_version_id, updated_at, settings",
      )
      .in("status", ["active", "beta"]),
    svc
      .from("credit_ledger")
      .select("delta, created_at")
      .lt("delta", 0)
      .like("reason", `${BOARDROOM_LEDGER_PREFIX}%`)
      .gte("created_at", since7d.toISOString()),
  ]);

  const dbBySlug = new Map(
    ((dbAgents ?? []) as AiAgentRow[]).map((row) => [row.slug, row]),
  );

  const stats = new Map<string, AgentStatsBucket>();

  for (const row of (usageRows ?? []) as UsageRow[]) {
    const slug = row.agent_slug;
    if (slug === "boardroom") continue;

    const bucket = stats.get(slug) ?? emptyStatsBucket();
    bucket.invocations += 1;
    bucket.credits += Number(row.credits_charged ?? 0);
    bucket.spend_myr += spendMyrFromRow(row);
    if (isFailed(row.metadata)) bucket.failures += 1;

    const day = row.created_at.slice(0, 10);
    const existing = bucket.daily.find((d) => d.day === day);
    if (existing) {
      existing.invocations += 1;
    } else {
      bucket.daily.push({ day, invocations: 1 });
    }
    stats.set(slug, bucket);
  }

  for (const row of (dailyRows ?? []) as DailyRollupRow[]) {
    const slug = row.agent_slug;
    if (slug === "boardroom") continue;

    const invocations = Number(row.invocations ?? 0);
    if (invocations <= 0) continue;

    const bucket = stats.get(slug) ?? emptyStatsBucket();
    bucket.invocations += invocations;
    bucket.spend_myr += Number(row.spend_cents ?? 0) / 100;
    bucket.failures += Number(row.failures ?? 0);

    const existing = bucket.daily.find((d) => d.day === row.day);
    if (existing) {
      existing.invocations += invocations;
    } else {
      bucket.daily.push({ day: row.day, invocations });
    }
    stats.set(slug, bucket);
  }

  const boardroomFromLedger = aggregateBoardroomLedgerRows(
    (boardroomLedger ?? []) as Array<{ delta: number; created_at: string }>,
  );
  if (boardroomFromLedger.invocations > 0) {
    stats.set("boardroom", boardroomFromLedger);
  }

  const tenantItems = TENANT_AI_AGENTS.map((def) =>
    buildAgentListItem(def, dbBySlug.get(def.slug), stats, false),
  );
  const platformItems = PLATFORM_AI_AGENTS.map((def) =>
    buildAgentListItem(def, dbBySlug.get(def.slug), stats, true),
  );
  return [...tenantItems, ...platformItems];
}

export async function loadPlatformAgentDetail(slug: string): Promise<{
  agent: AiAgentRow;
  version: AiAgentVersion | null;
  usage: AgentUsage7d;
  scopeConfigured: boolean;
}> {
  const tenantDef = TENANT_AI_AGENTS.find((a) => a.slug === slug);
  const platformDef = PLATFORM_AI_AGENTS.find((a) => a.slug === slug);
  if (!tenantDef && !platformDef) throw new Error(`agent not found: ${slug}`);

  const items = await loadPlatformAgentsDashboard();
  const item = items.find((i) => i.agent.slug === slug);
  if (!item) throw new Error(`agent not found: ${slug}`);

  const svc = createServiceRoleClient();
  const { data: dbAgent } = await svc
    .from("ai_agents")
    .select(
      "id, slug, name, short_desc, pillar, icon, default_model, status, published_version_id, updated_at, settings",
    )
    .eq("slug", slug)
    .maybeSingle();

  let version: AiAgentVersion | null = null;
  const publishedId = (dbAgent as AiAgentRow | null)?.published_version_id;
  if (publishedId) {
    const { data: ver } = await svc
      .from("ai_agent_versions")
      .select(
        "id, agent_id, version_label, system_prompt, allowed_actions, guardrails, escalation, knowledge_base, default_tone, published_at, created_at",
      )
      .eq("id", publishedId)
      .maybeSingle();
    if (ver) version = ver as unknown as AiAgentVersion;
  }

  return {
    agent: item.agent,
    version,
    usage: item.usage,
    scopeConfigured: item.scopeConfigured,
  };
}
