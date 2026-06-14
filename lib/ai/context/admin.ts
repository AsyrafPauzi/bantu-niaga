import "server-only";

import { createAgentScopedClient, verifyRows } from "./client";
import type { AgentContext, PillarSnapshot, SnapshotItem } from "./types";

/**
 * Admin / business overview snapshot.
 *
 * Surfaces the tenant's plan, subscription window, and the last few
 * meaningful audit-log entries so the Boardroom agent can answer
 * "what changed recently" without scanning the full audit log.
 */
export async function buildAdminSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  const supabase = await createAgentScopedClient(ctx);

  const businessRes = await supabase
    .from("businesses")
    .select(
      "id, name, tier, subscription_status, subscription_renewal_at, state_code, credit_balance, created_at",
    )
    .eq("id", ctx.businessId)
    .maybeSingle();

  const business = businessRes.data as
    | {
        id: string;
        name: string;
        tier: string;
        subscription_status: string | null;
        subscription_renewal_at: string | null;
        state_code: string | null;
        credit_balance: number | null;
        created_at: string;
      }
    | null;

  const auditRes = await supabase
    .from("audit_log")
    .select("id, business_id, action, entity_type, entity_id, created_at")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  const audit = verifyRows(auditRes, ctx, "audit_log");

  const recent: SnapshotItem[] = audit.map((a) => ({
    id: a.id as string,
    label: a.action as string,
    meta: `${a.entity_type ?? "—"}`,
    at: a.created_at as string,
  }));

  const generatedAt = new Date().toISOString();
  if (!business) {
    return {
      pillar: "admin",
      businessId: ctx.businessId,
      generatedAt,
      available: false,
      headline:
        "No business record found for this user. Cannot summarise admin state.",
      kpis: [],
      recent: [],
      attention: [],
    };
  }

  const renewalDate = business.subscription_renewal_at
    ? new Date(business.subscription_renewal_at)
    : null;
  const daysToRenewal = renewalDate
    ? Math.max(
        0,
        Math.round(
          (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return {
    pillar: "admin",
    businessId: ctx.businessId,
    generatedAt,
    available: true,
    headline: `Tenant "${business.name}" on tier=${business.tier} status=${business.subscription_status ?? "—"}.`,
    kpis: [
      { key: "tier", label: "Plan tier", value: business.tier },
      {
        key: "subscription_status",
        label: "Subscription",
        value: business.subscription_status ?? "—",
      },
      {
        key: "credit_balance",
        label: "Credit balance",
        value: business.credit_balance ?? 0,
        unit: "credits",
      },
      ...(daysToRenewal !== null
        ? [
            {
              key: "renewal_in_days",
              label: "Renews in",
              value: daysToRenewal,
              unit: "days",
            },
          ]
        : []),
      { key: "state_code", label: "State", value: business.state_code ?? "—" },
    ],
    recent,
    attention: [],
    notes:
      daysToRenewal !== null && daysToRenewal <= 7
        ? `Subscription renews in ${daysToRenewal} day(s).`
        : undefined,
  };
}
