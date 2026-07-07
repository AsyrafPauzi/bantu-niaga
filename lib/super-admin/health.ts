import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export type HealthBand = "healthy" | "watch" | "at_risk" | "critical";

export interface TenantHealthRow {
  businessId: string;
  businessName: string;
  idcompany: string;
  tier: TierKey;
  subscriptionStatus: string;
  score: number;
  band: HealthBand;
  signals: Record<string, string | number | boolean>;
  computedAt: string;
}

export interface TenantHealthSummary {
  healthy: number;
  watch: number;
  atRisk: number;
  critical: number;
  averageScore: number;
  tenants: TenantHealthRow[];
}

function bandForScore(score: number): HealthBand {
  if (score >= 75) return "healthy";
  if (score >= 55) return "watch";
  if (score >= 35) return "at_risk";
  return "critical";
}

/**
 * Compute health scores for all tenants and upsert snapshots.
 * Called by the tenant-health cron and on-demand from super-admin.
 */
export async function computeTenantHealthScores(): Promise<number> {
  const svc = createServiceRoleClient();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: businesses },
    { data: auditActive },
    { data: dsrs },
    { data: addonCounts },
    { data: memberCounts },
    { data: aiStats },
  ] = await Promise.all([
    svc
      .from("businesses")
      .select("id, name, idcompany, tier, subscription_status, credit_balance, created_at"),
    svc.rpc("super_admin_audit_active_businesses", { p_since: since30d }),
    svc
      .from("data_subject_requests")
      .select("business_id, status")
      .in("status", ["pending", "in_progress"]),
    svc.rpc("super_admin_addon_counts"),
    svc.rpc("super_admin_membership_counts"),
    svc.rpc("super_admin_ai_usage_stats_since", { p_since: since30d }),
  ]);

  const auditRecent = new Set(
    (auditActive ?? []).map((r: { business_id: string }) => r.business_id),
  );
  const openDsr = new Set((dsrs ?? []).map((r) => r.business_id as string));
  const addonByBiz = new Map<string, number>();
  for (const row of addonCounts ?? []) {
    addonByBiz.set(row.business_id as string, Number(row.addon_count ?? 0));
  }
  const usersByBiz = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    usersByBiz.set(row.business_id as string, Number(row.member_count ?? 0));
  }
  const aiFailByBiz = new Map<string, { total: number; failed: number }>();
  for (const row of aiStats ?? []) {
    aiFailByBiz.set(row.business_id as string, {
      total: Number(row.total_count ?? 0),
      failed: Number(row.failed_count ?? 0),
    });
  }

  const now = new Date().toISOString();
  const rows: Array<{
    business_id: string;
    score: number;
    band: HealthBand;
    signals: Record<string, string | number | boolean>;
    computed_at: string;
  }> = [];

  for (const biz of businesses ?? []) {
    let score = 50;
    const signals: Record<string, string | number | boolean> = {};

    switch (biz.subscription_status) {
      case "active":
        score += 15;
        signals.subscription = "active";
        break;
      case "trial":
        signals.subscription = "trial";
        break;
      case "past_due":
        score -= 25;
        signals.subscription = "past_due";
        break;
      case "cancelled":
        score -= 40;
        signals.subscription = "cancelled";
        break;
      default:
        signals.subscription = String(biz.subscription_status);
    }

    const credits = Number(biz.credit_balance ?? 0);
    if (credits < 10) {
      score -= 15;
      signals.low_credits = true;
    } else if (credits >= 50) {
      score += 5;
    }
    signals.credit_balance = credits;

    if (auditRecent.has(biz.id)) {
      score += 15;
      signals.active_30d = true;
    } else {
      score -= 20;
      signals.active_30d = false;
    }

    const members = usersByBiz.get(biz.id) ?? 0;
    if (members > 1) {
      score += 5;
      signals.team_size = members;
    }

    const addons = addonByBiz.get(biz.id) ?? 0;
    if (addons > 0) {
      score += Math.min(10, addons * 3);
      signals.addon_count = addons;
    }

    if (openDsr.has(biz.id)) {
      score -= 15;
      signals.open_dsr = true;
    }

    const ai = aiFailByBiz.get(biz.id);
    if (ai && ai.total >= 5) {
      const failPct = Math.round((ai.failed / ai.total) * 100);
      signals.ai_failure_pct = failPct;
      if (failPct > 15) score -= 15;
      else if (failPct > 5) score -= 5;
    }

    if (biz.tier !== "starter") score += 5;

    score = Math.max(0, Math.min(100, score));
    const band = bandForScore(score);

    rows.push({
      business_id: biz.id,
      score,
      band,
      signals,
      computed_at: now,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await svc.from("tenant_health_snapshots").upsert(rows, {
    onConflict: "business_id",
  });
  if (error) throw new Error(error.message);

  return rows.length;
}

export async function loadTenantHealth(): Promise<TenantHealthSummary> {
  const svc = createServiceRoleClient();

  const [{ data: snapshots }, { data: businesses }] = await Promise.all([
    svc
      .from("tenant_health_snapshots")
      .select("business_id, score, band, signals, computed_at")
      .order("score", { ascending: true }),
    svc
      .from("businesses")
      .select("id, name, idcompany, tier, subscription_status"),
  ]);

  const bizMap = new Map(
    (businesses ?? []).map((b) => [b.id as string, b]),
  );

  const tenants: TenantHealthRow[] = (snapshots ?? []).map((s) => {
    const biz = bizMap.get(s.business_id as string);
    return {
      businessId: s.business_id as string,
      businessName: (biz?.name as string) ?? "Tenant",
      idcompany: (biz?.idcompany as string) ?? "",
      tier: (biz?.tier as TierKey) ?? "starter",
      subscriptionStatus: (biz?.subscription_status as string) ?? "trial",
      score: s.score as number,
      band: s.band as HealthBand,
      signals: (s.signals as Record<string, string | number | boolean>) ?? {},
      computedAt: s.computed_at as string,
    };
  });

  const summary = {
    healthy: 0,
    watch: 0,
    atRisk: 0,
    critical: 0,
    averageScore: 0,
    tenants,
  };

  for (const t of tenants) {
    if (t.band === "healthy") summary.healthy += 1;
    else if (t.band === "watch") summary.watch += 1;
    else if (t.band === "at_risk") summary.atRisk += 1;
    else summary.critical += 1;
  }
  summary.averageScore =
    tenants.length > 0
      ? Math.round(tenants.reduce((s, t) => s + t.score, 0) / tenants.length)
      : 0;

  return summary;
}

export function healthBandLabel(band: HealthBand): string {
  switch (band) {
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    case "at_risk":
      return "At risk";
    case "critical":
      return "Critical";
  }
}

export function tierMrrMyr(tier: TierKey): number {
  return tierBy(tier)?.priceMyr ?? 0;
}
