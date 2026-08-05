import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export interface RevenueMonthRow {
  month: string;
  label: string;
  subscriptionMyr: number;
  addonMyr: number;
  topupMyr: number;
  manualMyr: number;
  totalMyr: number;
}

export interface PlanRevenueRow {
  tier: TierKey;
  label: string;
  count: number;
  mrrMyr: number;
}

export interface AddonMrrRow {
  slug: string;
  name: string;
  mrrMyr: number;
  tenantCount: number;
}

export interface RevenueDashboard {
  mrrSubscriptionMyr: number;
  mrrAddonMyr: number;
  mrrTotalMyr: number;
  mrrGrowthPct: number | null;
  netNewMrrMyr: number;
  arpuMyr: number;
  payingTenantCount: number;
  collectedLast30dMyr: number;
  collectedLast90dMyr: number;
  pendingInvoicesMyr: number;
  pendingInvoiceCount: number;
  paidInvoiceCount: number;
  aiCost30dMyr: number;
  grossMarginPct: number | null;
  monthly: RevenueMonthRow[];
  mrrSparkline: number[];
  byKind: { kind: string; label: string; amountMyr: number; count: number }[];
  planRevenue: PlanRevenueRow[];
  addonMrrBySlug: AddonMrrRow[];
  topTenants: { businessId: string; name: string; amountMyr: number }[];
}

const KIND_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  addon: "Add-ons",
  topup: "Credit top-ups",
  manual: "Manual / other",
};

const TIER_ORDER: TierKey[] = ["starter", "micro", "sme", "enterprise"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-MY", { month: "short", year: "2-digit" });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addonMrrFromRow(
  priceCents: number,
  cadence: string,
  qty: number,
): number {
  if (cadence === "monthly") return (priceCents / 100) * qty;
  if (cadence === "yearly") return (priceCents / 100 / 12) * qty;
  return 0;
}

export async function loadRevenueDashboard(): Promise<RevenueDashboard> {
  const svc = createServiceRoleClient();
  const since12m = new Date();
  since12m.setUTCMonth(since12m.getUTCMonth() - 12);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: paidInvoices },
    { data: pendingInvoices },
    { data: businesses },
    { data: addons },
    { data: aiUsage },
  ] = await Promise.all([
    svc
      .from("invoices")
      .select("business_id, kind, amount_myr, status, paid_at, created_at, businesses(name)")
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .gte("paid_at", since12m.toISOString())
      .order("paid_at", { ascending: false })
      .limit(5000),
    svc
      .from("invoices")
      .select("amount_myr")
      .eq("status", "pending"),
    svc.from("businesses").select("id, tier, subscription_status"),
    svc
      .from("business_addons")
      .select(
        "business_id, qty, status, marketplace_addons(slug, name, price_cents, cadence)",
      )
      .eq("status", "active"),
    svc
      .from("ai_usage")
      .select("cost_myr_estimated, credits_charged")
      .gte("created_at", since30d),
  ]);

  const paying = (businesses ?? []).filter(
    (b) => b.subscription_status !== "cancelled" && b.tier !== "starter",
  );
  const mrrSubscriptionMyr = paying.reduce(
    (s, b) => s + (tierBy(b.tier as TierKey)?.priceMyr ?? 0),
    0,
  );

  let mrrAddonMyr = 0;
  const addonMrrMap = new Map<
    string,
    { name: string; mrrMyr: number; tenants: Set<string> }
  >();

  for (const row of addons ?? []) {
    const ma = row.marketplace_addons as
      | { slug: string; name: string; price_cents: number; cadence: string }
      | { slug: string; name: string; price_cents: number; cadence: string }[]
      | null;
    const addon = Array.isArray(ma) ? ma[0] : ma;
    if (!addon) continue;
    const qty = Number(row.qty ?? 1);
    const rowMrr = addonMrrFromRow(addon.price_cents, addon.cadence, qty);
    mrrAddonMyr += rowMrr;

    const slug = addon.slug;
    const prev = addonMrrMap.get(slug) ?? {
      name: addon.name,
      mrrMyr: 0,
      tenants: new Set<string>(),
    };
    prev.mrrMyr += rowMrr;
    prev.tenants.add(row.business_id as string);
    addonMrrMap.set(slug, prev);
  }

  const tierCount: Record<TierKey, number> = {
    starter: 0,
    micro: 0,
    sme: 0,
    enterprise: 0,
  };
  for (const b of businesses ?? []) {
    const t = b.tier as TierKey;
    if (tierCount[t] !== undefined) tierCount[t] += 1;
  }

  const planRevenue: PlanRevenueRow[] = TIER_ORDER.map((tier) => {
    const meta = tierBy(tier)!;
    const count =
      tier === "starter"
        ? tierCount[tier]
        : (businesses ?? []).filter(
            (b) =>
              b.tier === tier && b.subscription_status !== "cancelled",
          ).length;
    return {
      tier,
      label: meta.label,
      count,
      mrrMyr: round2(count * (meta.priceMyr ?? 0)),
    };
  }).filter((p) => p.tier !== "starter" || p.count > 0);

  const addonMrrBySlug: AddonMrrRow[] = Array.from(addonMrrMap.entries())
    .map(([slug, v]) => ({
      slug,
      name: v.name,
      mrrMyr: round2(v.mrrMyr),
      tenantCount: v.tenants.size,
    }))
    .sort((a, b) => b.mrrMyr - a.mrrMyr);

  const now = Date.now();
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const monthBuckets = new Map<string, RevenueMonthRow>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = monthKey(d);
    monthBuckets.set(key, {
      month: key,
      label: monthLabel(key),
      subscriptionMyr: 0,
      addonMyr: 0,
      topupMyr: 0,
      manualMyr: 0,
      totalMyr: 0,
    });
  }

  const kindTotals = new Map<string, { amountMyr: number; count: number }>();
  const tenantTotals = new Map<string, { name: string; amountMyr: number }>();
  let collectedLast30dMyr = 0;
  let collectedLast90dMyr = 0;
  let paidInvoiceCount = 0;

  for (const inv of paidInvoices ?? []) {
    const amount = Number(inv.amount_myr ?? 0);
    const kind = String(inv.kind ?? "manual");
    const paidAt = inv.paid_at ? new Date(inv.paid_at as string) : null;

    paidInvoiceCount += 1;

    if (paidAt) {
      if (paidAt >= d30) collectedLast30dMyr += amount;
      if (paidAt >= d90) collectedLast90dMyr += amount;

      const key = monthKey(paidAt);
      const bucket = monthBuckets.get(key);
      if (bucket) {
        if (kind === "subscription") bucket.subscriptionMyr += amount;
        else if (kind === "addon") bucket.addonMyr += amount;
        else if (kind === "topup") bucket.topupMyr += amount;
        else bucket.manualMyr += amount;
        bucket.totalMyr += amount;
      }
    }

    const kt = kindTotals.get(kind) ?? { amountMyr: 0, count: 0 };
    kt.amountMyr += amount;
    kt.count += 1;
    kindTotals.set(kind, kt);

    const bizId = inv.business_id as string;
    const bizJoin = inv.businesses as
      | { name: string }
      | { name: string }[]
      | null;
    const bizName = Array.isArray(bizJoin)
      ? bizJoin[0]?.name
      : bizJoin?.name ?? "Tenant";
    const tt = tenantTotals.get(bizId) ?? { name: bizName, amountMyr: 0 };
    tt.amountMyr += amount;
    tenantTotals.set(bizId, tt);
  }

  let pendingInvoicesMyr = 0;
  let pendingInvoiceCount = 0;
  for (const inv of pendingInvoices ?? []) {
    pendingInvoicesMyr += Number(inv.amount_myr ?? 0);
    pendingInvoiceCount += 1;
  }

  const monthly = Array.from(monthBuckets.values());
  const mrrSparkline = monthly.slice(-6).map((m) => m.subscriptionMyr + m.addonMyr);

  const currentMonth = monthly.at(-1);
  const previousMonth = monthly.at(-2);
  const netNewMrrMyr =
    currentMonth && previousMonth
      ? round2(
          currentMonth.subscriptionMyr +
            currentMonth.addonMyr -
            (previousMonth.subscriptionMyr + previousMonth.addonMyr),
        )
      : 0;

  const prevRecurring =
    previousMonth != null
      ? previousMonth.subscriptionMyr + previousMonth.addonMyr
      : 0;
  const mrrGrowthPct =
    previousMonth && prevRecurring > 0
      ? round2(
          ((currentMonth!.subscriptionMyr +
            currentMonth!.addonMyr -
            prevRecurring) /
            prevRecurring) *
            100,
        )
      : null;

  let aiCost30dMyr = 0;
  for (const row of aiUsage ?? []) {
    const est = Number(row.cost_myr_estimated ?? 0);
    aiCost30dMyr += est > 0 ? est : Number(row.credits_charged ?? 0) * 0.01;
  }
  aiCost30dMyr = round2(aiCost30dMyr);

  const mrrTotalMyr = mrrSubscriptionMyr + mrrAddonMyr;
  const arpuMyr =
    paying.length > 0 ? round2(mrrTotalMyr / paying.length) : 0;
  const grossMarginPct =
    collectedLast30dMyr > 0
      ? round2(
          ((collectedLast30dMyr - aiCost30dMyr) / collectedLast30dMyr) * 100,
        )
      : null;

  const byKind = Array.from(kindTotals.entries()).map(([kind, v]) => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    amountMyr: round2(v.amountMyr),
    count: v.count,
  }));

  const topTenants = Array.from(tenantTotals.entries())
    .map(([businessId, v]) => ({
      businessId,
      name: v.name,
      amountMyr: round2(v.amountMyr),
    }))
    .sort((a, b) => b.amountMyr - a.amountMyr);

  return {
    mrrSubscriptionMyr: round2(mrrSubscriptionMyr),
    mrrAddonMyr: round2(mrrAddonMyr),
    mrrTotalMyr: round2(mrrTotalMyr),
    mrrGrowthPct,
    netNewMrrMyr,
    arpuMyr,
    payingTenantCount: paying.length,
    collectedLast30dMyr: round2(collectedLast30dMyr),
    collectedLast90dMyr: round2(collectedLast90dMyr),
    pendingInvoicesMyr: round2(pendingInvoicesMyr),
    pendingInvoiceCount,
    paidInvoiceCount,
    aiCost30dMyr,
    grossMarginPct,
    monthly,
    mrrSparkline,
    byKind,
    planRevenue,
    addonMrrBySlug,
    topTenants,
  };
}
