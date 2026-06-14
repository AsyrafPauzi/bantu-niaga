import "server-only";

import { createAgentScopedClient, verifyRows } from "./client";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
} from "./types";

/**
 * Marketing overview snapshot.
 *
 * Aggregates customers, content_plan posts, and live social_accounts —
 * everything Maya needs to draft a follow-up campaign or summarise
 * pipeline without the agent itself running SQL.
 */
export async function buildMarketingSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  const supabase = await createAgentScopedClient(ctx);

  const customersRes = await supabase
    .from("customers")
    .select(
      "id, business_id, name, total_spend_myr, order_count, last_purchase_at, manual_tags, created_at",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("last_purchase_at", { ascending: false, nullsFirst: false })
    .limit(50);
  const customers = verifyRows(customersRes, ctx, "customers");

  const contentRes = await supabase
    .from("content_plan")
    .select("id, business_id, channel, status, scheduled_at, posted_at, hook, created_at")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(20);
  const content = verifyRows(contentRes, ctx, "content_plan");

  // social_accounts table only exists after migration 16; the .from()
  // call will return an error if it hasn't been applied yet. Guard it.
  let socialActive = 0;
  try {
    const socialRes = await supabase
      .from("social_accounts")
      .select("id, business_id, provider, status")
      .eq("business_id", ctx.businessId)
      .eq("status", "active");
    const social = verifyRows(socialRes, ctx, "social_accounts");
    socialActive = social.length;
  } catch {
    /* table missing or RLS denied — degrade gracefully */
  }

  const totalSpend = customers.reduce(
    (acc, c) => acc + Number(c.total_spend_myr ?? 0),
    0,
  );
  const averageSpend = customers.length
    ? totalSpend / customers.length
    : 0;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const dormant7d = customers.filter((c) => {
    const last = c.last_purchase_at
      ? new Date(c.last_purchase_at as string).getTime()
      : 0;
    return last > 0 && last < sevenDaysAgo;
  }).length;

  const postsScheduled = content.filter((p) => p.status === "scheduled").length;
  const postsPosted = content.filter((p) => p.status === "posted").length;
  const postsDrafted = content.filter(
    (p) => p.status === "drafted" || p.status === "idea",
  ).length;

  const recent: SnapshotItem[] = content.slice(0, 8).map((p) => ({
    id: p.id as string,
    label: `${p.channel} · ${p.status}`,
    meta:
      typeof p.hook === "string"
        ? p.hook.slice(0, 70)
        : (p.status as string),
    at: (p.scheduled_at as string | null) ?? (p.created_at as string),
  }));

  const attention: SnapshotAttention[] = [];
  if (socialActive === 0) {
    attention.push({
      id: "no_social_connected",
      label:
        "No live social account — Marketing can't publish until at least one channel is connected.",
      severity: "medium",
    });
  }
  if (dormant7d >= Math.max(3, Math.floor(customers.length * 0.4))) {
    attention.push({
      id: "dormant_pile",
      label: `${dormant7d} customer(s) haven't purchased in 7+ days — reactivation campaign candidate.`,
      severity: "medium",
    });
  }

  return {
    pillar: "marketing",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: true,
    headline: `Marketing snapshot: ${customers.length} customers, ${content.length} content rows, ${socialActive} live social account(s).`,
    kpis: [
      { key: "customers_total", label: "Customers (visible)", value: customers.length },
      {
        key: "avg_spend",
        label: "Avg customer spend",
        value: Number(averageSpend.toFixed(2)),
        unit: "MYR",
      },
      {
        key: "total_spend",
        label: "Total customer spend",
        value: Number(totalSpend.toFixed(2)),
        unit: "MYR",
      },
      { key: "dormant_7d", label: "Dormant > 7 days", value: dormant7d },
      { key: "posts_scheduled", label: "Posts scheduled", value: postsScheduled },
      { key: "posts_posted", label: "Posts posted", value: postsPosted },
      { key: "posts_drafted", label: "Posts drafted", value: postsDrafted },
      { key: "social_active", label: "Active social channels", value: socialActive },
    ],
    recent,
    attention,
  };
}
