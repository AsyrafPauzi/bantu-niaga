import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildMayaCommerceContext } from "@/lib/ai/maya-commerce-context";
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
 * Aggregates customers, segments, coupons, content_plan posts, plus a
 * commerce summary (products + monthly invoice/order sales) for Maya.
 */
export async function buildMarketingSnapshot(
  ctx: AgentContext,
  client?: SupabaseClient,
): Promise<PillarSnapshot> {
  const supabase = client ?? (await createAgentScopedClient(ctx));

  const customersRes = await supabase
    .from("customers")
    .select(
      "id, business_id, name, total_spend_myr, order_count, last_purchase_at, manual_tags, auto_tags, created_at",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("last_purchase_at", { ascending: false, nullsFirst: false })
    .limit(50);
  const customers = verifyRows(customersRes, ctx, "customers");

  const contentRes = await supabase
    .from("content_plan")
    .select(
      "id, business_id, channel, status, scheduled_at, posted_at, hook, created_at",
    )
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(20);
  const content = verifyRows(contentRes, ctx, "content_plan");

  const segmentsRes = await supabase
    .from("customer_segments")
    .select("id, business_id, name")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(30);
  const segments = verifyRows(segmentsRes, ctx, "customer_segments");

  const couponsRes = await supabase
    .from("coupons")
    .select("id, business_id, code, status, type, value, valid_until")
    .eq("business_id", ctx.businessId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  const coupons = verifyRows(couponsRes, ctx, "coupons");

  let commerce: Awaited<ReturnType<typeof buildMayaCommerceContext>> | null =
    null;
  try {
    commerce = await buildMayaCommerceContext(ctx, supabase);
  } catch {
    commerce = null;
  }

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
  const averageSpend = customers.length ? totalSpend / customers.length : 0;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const dormant7d = customers.filter((c) => {
    const last = c.last_purchase_at
      ? new Date(c.last_purchase_at as string).getTime()
      : 0;
    return last > 0 && last < sevenDaysAgo;
  }).length;

  const vipCount = customers.filter((c) => {
    const auto = Array.isArray(c.auto_tags) ? c.auto_tags : [];
    return auto.includes("vip");
  }).length;

  const postsScheduled = content.filter((p) => p.status === "scheduled").length;
  const postsPosted = content.filter((p) => p.status === "posted").length;
  const postsDrafted = content.filter(
    (p) => p.status === "drafted" || p.status === "idea",
  ).length;

  const recent: SnapshotItem[] = [
    ...segments.slice(0, 8).map((s) => ({
      id: s.id as string,
      label: `Segment · ${s.name}`,
      meta: "use for broadcasts",
      at: new Date().toISOString(),
    })),
    ...content.slice(0, 6).map((p) => ({
      id: p.id as string,
      label: `${p.channel} · ${p.status}`,
      meta:
        typeof p.hook === "string"
          ? p.hook.slice(0, 70)
          : (p.status as string),
      at: (p.scheduled_at as string | null) ?? (p.created_at as string),
    })),
    ...coupons.slice(0, 6).map((c) => ({
      id: c.id as string,
      label: `Coupon · ${c.code}`,
      meta: `${c.type} ${c.value}`,
      at: (c.valid_until as string | null) ?? new Date().toISOString(),
    })),
  ];

  if (commerce?.topSoldLines.length) {
    for (const line of commerce.topSoldLines.slice(0, 4)) {
      recent.push({
        id: `sold-${line.description.slice(0, 24)}`,
        label: `Sold · ${line.description}`,
        meta: `qty ${line.qty} · RM ${line.revenue_myr.toFixed(2)}`,
        at: new Date().toISOString(),
      });
    }
  }

  const attention: SnapshotAttention[] = [];
  if (customers.length === 0) {
    attention.push({
      id: "no_customers",
      label: "No customers yet — import or add your first buyer in CRM.",
      severity: "high",
    });
  }
  if (dormant7d >= Math.max(3, Math.floor(customers.length * 0.4))) {
    attention.push({
      id: "dormant_pile",
      label: `${dormant7d} customer(s) haven't purchased in 7+ days — reactivation campaign candidate.`,
      severity: "medium",
    });
  }
  if (segments.length === 0 && customers.length > 0) {
    attention.push({
      id: "no_segments",
      label: "No segments yet — create one before drafting a broadcast.",
      severity: "low",
    });
  }
  if (
    commerce &&
    commerce.salesDeltaPct !== null &&
    commerce.salesDeltaPct < -10
  ) {
    attention.push({
      id: "sales_down",
      label: `Sales MTD are ${commerce.salesDeltaPct}% vs last month — ask Maya for a boost plan.`,
      severity: "high",
    });
  }
  for (const gap of commerce?.dataGaps.slice(0, 2) ?? []) {
    attention.push({
      id: `gap-${gap.slice(0, 24)}`,
      label: gap,
      severity: "low",
    });
  }

  const commerceNote = commerce
    ? `Commerce ${commerce.monthLabel}: MTD RM ${commerce.combinedMtdMyr.toFixed(2)} (invoices + completed orders). Products: ${commerce.productCount}.`
    : undefined;

  return {
    pillar: "marketing",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available: true,
    headline: `Marketing snapshot: ${customers.length} customers, ${segments.length} segments, ${coupons.length} active coupons, ${content.length} content rows${
      commerce
        ? `, sales MTD RM ${commerce.combinedMtdMyr.toFixed(0)}`
        : ""
    }.`,
    kpis: [
      {
        key: "customers_total",
        label: "Customers (visible)",
        value: customers.length,
      },
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
      { key: "vip_count", label: "VIP (auto-tag)", value: vipCount },
      { key: "dormant_7d", label: "Dormant > 7 days", value: dormant7d },
      { key: "segments_total", label: "Segments", value: segments.length },
      { key: "coupons_active", label: "Active coupons", value: coupons.length },
      {
        key: "sales_mtd",
        label: "Sales MTD (invoices+orders)",
        value: Number((commerce?.combinedMtdMyr ?? 0).toFixed(2)),
        unit: "MYR",
        delta:
          commerce?.salesDeltaPct === null ||
          commerce?.salesDeltaPct === undefined
            ? undefined
            : `${commerce.salesDeltaPct > 0 ? "+" : ""}${commerce.salesDeltaPct}% vs last month`,
      },
      {
        key: "products_active",
        label: "Active products",
        value: commerce?.productCount ?? 0,
      },
      { key: "posts_scheduled", label: "Posts scheduled", value: postsScheduled },
      { key: "posts_posted", label: "Posts posted", value: postsPosted },
      { key: "posts_drafted", label: "Posts drafted", value: postsDrafted },
      {
        key: "social_active",
        label: "Active social channels",
        value: socialActive,
      },
    ],
    recent,
    attention,
    notes: [
      segments.length > 0
        ? `Segments available: ${segments.map((s) => s.name).join(", ")}.`
        : null,
      commerceNote,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
