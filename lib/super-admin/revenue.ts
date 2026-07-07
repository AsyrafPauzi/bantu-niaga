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

export interface RevenueDashboard {
  mrrSubscriptionMyr: number;
  mrrAddonMyr: number;
  mrrTotalMyr: number;
  collectedLast30dMyr: number;
  collectedLast90dMyr: number;
  pendingInvoicesMyr: number;
  paidInvoiceCount: number;
  monthly: RevenueMonthRow[];
  byKind: { kind: string; label: string; amountMyr: number; count: number }[];
  topTenants: { businessId: string; name: string; amountMyr: number }[];
}

const KIND_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  addon: "Add-ons",
  topup: "Credit top-ups",
  manual: "Manual / other",
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-MY", { month: "short", year: "2-digit" });
}

export async function loadRevenueDashboard(): Promise<RevenueDashboard> {
  const svc = createServiceRoleClient();
  const since12m = new Date();
  since12m.setUTCMonth(since12m.getUTCMonth() - 12);

  const [{ data: invoices }, { data: businesses }, { data: addons }] =
    await Promise.all([
      svc
        .from("invoices")
        .select("business_id, kind, amount_myr, status, paid_at, created_at, businesses(name)")
        .eq("status", "paid")
        .not("paid_at", "is", null)
        .gte("paid_at", since12m.toISOString())
        .order("paid_at", { ascending: false })
        .limit(5000),
      svc.from("businesses").select("id, tier, subscription_status"),
      svc
        .from("business_addons")
        .select("business_id, qty, status, marketplace_addons(price_cents, cadence)")
        .eq("status", "active"),
    ]);

  const paying = (businesses ?? []).filter(
    (b) => b.subscription_status !== "cancelled" && b.tier !== "starter",
  );
  const mrrSubscriptionMyr = paying.reduce(
    (s, b) => s + (tierBy(b.tier as TierKey)?.priceMyr ?? 0),
    0,
  );

  let mrrAddonMyr = 0;
  for (const row of addons ?? []) {
    const ma = row.marketplace_addons as
      | { price_cents: number; cadence: string }
      | { price_cents: number; cadence: string }[]
      | null;
    const addon = Array.isArray(ma) ? ma[0] : ma;
    if (!addon) continue;
    const qty = Number(row.qty ?? 1);
    if (addon.cadence === "monthly") {
      mrrAddonMyr += (addon.price_cents / 100) * qty;
    } else if (addon.cadence === "yearly") {
      mrrAddonMyr += (addon.price_cents / 100 / 12) * qty;
    }
  }

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
  let pendingInvoicesMyr = 0;
  let paidInvoiceCount = 0;

  for (const inv of invoices ?? []) {
    const amount = Number(inv.amount_myr ?? 0);
    const kind = String(inv.kind ?? "manual");
    const status = String(inv.status ?? "pending");
    const paidAt = inv.paid_at ? new Date(inv.paid_at as string) : null;

    if (status === "pending") {
      pendingInvoicesMyr += amount;
    }

    if (status !== "paid") continue;
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
    const bizJoin = inv.businesses as { name: string } | { name: string }[] | null;
    const bizName = Array.isArray(bizJoin)
      ? bizJoin[0]?.name
      : bizJoin?.name ?? "Tenant";
    const tt = tenantTotals.get(bizId) ?? { name: bizName, amountMyr: 0 };
    tt.amountMyr += amount;
    tenantTotals.set(bizId, tt);
  }

  const byKind = Array.from(kindTotals.entries()).map(([kind, v]) => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    amountMyr: Math.round(v.amountMyr * 100) / 100,
    count: v.count,
  }));

  const topTenants = Array.from(tenantTotals.entries())
    .map(([businessId, v]) => ({
      businessId,
      name: v.name,
      amountMyr: Math.round(v.amountMyr * 100) / 100,
    }))
    .sort((a, b) => b.amountMyr - a.amountMyr);

  return {
    mrrSubscriptionMyr: Math.round(mrrSubscriptionMyr * 100) / 100,
    mrrAddonMyr: Math.round(mrrAddonMyr * 100) / 100,
    mrrTotalMyr: Math.round((mrrSubscriptionMyr + mrrAddonMyr) * 100) / 100,
    collectedLast30dMyr: Math.round(collectedLast30dMyr * 100) / 100,
    collectedLast90dMyr: Math.round(collectedLast90dMyr * 100) / 100,
    pendingInvoicesMyr: Math.round(pendingInvoicesMyr * 100) / 100,
    paidInvoiceCount,
    monthly: Array.from(monthBuckets.values()),
    byKind,
    topTenants,
  };
}
