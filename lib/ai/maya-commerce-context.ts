import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentContext } from "@/lib/ai/context/types";
import { createAgentScopedClient, verifyRows } from "@/lib/ai/context/client";

export interface MayaCommerceContext {
  monthLabel: string;
  prevMonthLabel: string;
  invoicePaidMtdMyr: number;
  invoicePaidPrevMyr: number;
  ordersDoneMtdMyr: number;
  ordersDonePrevMyr: number;
  combinedMtdMyr: number;
  combinedPrevMyr: number;
  salesDeltaPct: number | null;
  productCount: number;
  topProducts: Array<{ name: string; price_myr: number; category: string | null }>;
  topSoldLines: Array<{ description: string; qty: number; revenue_myr: number }>;
  slowCatalogHints: string[];
  dataGaps: string[];
  text: string;
}

function malaysiaMonthBounds(now = new Date()): {
  monthStart: Date;
  nextMonthStart: Date;
  prevMonthStart: Date;
  monthLabel: string;
  prevMonthLabel: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const nextMonthStart = new Date(Date.UTC(y, m, 1));
  const prevMonthStart = new Date(Date.UTC(y, m - 2, 1));
  const monthLabel = new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(now);
  const prevMonthLabel = new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(Date.UTC(y, m - 2, 15)));
  return { monthStart, nextMonthStart, prevMonthStart, monthLabel, prevMonthLabel };
}

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/**
 * Commerce packet for Maya: Finance invoices (paid) + Operations orders (done)
 * as the POS/counter proxy, plus product catalog. Tenant-scoped via RLS.
 */
export async function buildMayaCommerceContext(
  ctx: AgentContext,
  client?: SupabaseClient,
): Promise<MayaCommerceContext> {
  const supabase = client ?? (await createAgentScopedClient(ctx));
  const {
    monthStart,
    nextMonthStart,
    prevMonthStart,
    monthLabel,
    prevMonthLabel,
  } = malaysiaMonthBounds();

  const dataGaps: string[] = [];

  const productsRes = await supabase
    .from("operations_products")
    .select("id, business_id, name, category, price_myr, is_active")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(40);
  const products = verifyRows(productsRes, ctx, "operations_products");

  const invoicesRes = await supabase
    .from("finance_invoices")
    .select(
      "id, business_id, status, total_myr, paid_at, invoice_date, created_at",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(200);
  const invoices = verifyRows(invoicesRes, ctx, "finance_invoices");

  const ordersRes = await supabase
    .from("operations_orders")
    .select(
      "id, business_id, status, amount_myr, title, completed_at, created_at",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .limit(200);
  const orders = verifyRows(ordersRes, ctx, "operations_orders");

  const paidMtd = invoices.filter((i) =>
    inRange(
      (i.paid_at as string | null) ?? (i.invoice_date as string | null),
      monthStart,
      nextMonthStart,
    ),
  );
  const paidPrev = invoices.filter((i) =>
    inRange(
      (i.paid_at as string | null) ?? (i.invoice_date as string | null),
      prevMonthStart,
      monthStart,
    ),
  );

  const ordersMtd = orders.filter((o) =>
    inRange(
      (o.completed_at as string | null) ?? (o.created_at as string),
      monthStart,
      nextMonthStart,
    ),
  );
  const ordersPrev = orders.filter((o) =>
    inRange(
      (o.completed_at as string | null) ?? (o.created_at as string),
      prevMonthStart,
      monthStart,
    ),
  );

  const invoicePaidMtdMyr = paidMtd.reduce(
    (a, i) => a + Number(i.total_myr ?? 0),
    0,
  );
  const invoicePaidPrevMyr = paidPrev.reduce(
    (a, i) => a + Number(i.total_myr ?? 0),
    0,
  );
  const ordersDoneMtdMyr = ordersMtd.reduce(
    (a, o) => a + Number(o.amount_myr ?? 0),
    0,
  );
  const ordersDonePrevMyr = ordersPrev.reduce(
    (a, o) => a + Number(o.amount_myr ?? 0),
    0,
  );
  const combinedMtdMyr = invoicePaidMtdMyr + ordersDoneMtdMyr;
  const combinedPrevMyr = invoicePaidPrevMyr + ordersDonePrevMyr;
  const salesDeltaPct =
    combinedPrevMyr > 0
      ? Number(
          (
            ((combinedMtdMyr - combinedPrevMyr) / combinedPrevMyr) *
            100
          ).toFixed(1),
        )
      : null;

  const invoiceIdsMtd = paidMtd.map((i) => i.id as string);
  const lineMap = new Map<
    string,
    { description: string; qty: number; revenue_myr: number }
  >();

  if (invoiceIdsMtd.length > 0) {
    const itemsRes = await supabase
      .from("finance_invoice_items")
      .select(
        "id, business_id, invoice_id, description, quantity, line_total_myr",
      )
      .eq("business_id", ctx.businessId)
      .in("invoice_id", invoiceIdsMtd.slice(0, 80))
      .limit(300);
    const items = verifyRows(itemsRes, ctx, "finance_invoice_items");
    for (const item of items) {
      const key = String(item.description ?? "")
        .trim()
        .toLowerCase();
      if (!key) continue;
      const prev = lineMap.get(key);
      const qty = Number(item.quantity ?? 0);
      const rev = Number(item.line_total_myr ?? 0);
      if (prev) {
        prev.qty += qty;
        prev.revenue_myr += rev;
      } else {
        lineMap.set(key, {
          description: String(item.description),
          qty,
          revenue_myr: rev,
        });
      }
    }
  }

  const topSoldLines = [...lineMap.values()]
    .sort((a, b) => b.revenue_myr - a.revenue_myr)
    .slice(0, 8);

  const topProducts = products.slice(0, 12).map((p) => ({
    name: String(p.name),
    price_myr: Number(p.price_myr ?? 0),
    category: (p.category as string | null) ?? null,
  }));

  // Catalog items never appearing in this month's invoice lines → slow-mover hints
  const soldNames = new Set(
    topSoldLines.map((l) => l.description.trim().toLowerCase()),
  );
  const slowCatalogHints = products
    .filter((p) => !soldNames.has(String(p.name).trim().toLowerCase()))
    .slice(0, 6)
    .map((p) => String(p.name));

  if (products.length === 0) {
    dataGaps.push(
      "No active products in Operations catalog — add products so Maya can push specific SKUs.",
    );
  }
  if (invoices.length === 0 && orders.length === 0) {
    dataGaps.push(
      "No paid invoices or completed orders yet — record Finance invoices and/or Operations orders (POS/counter proxy).",
    );
  } else if (combinedMtdMyr === 0) {
    dataGaps.push(
      `No recorded sales in ${monthLabel} yet — plan can still use CRM (dormant/VIP) while sales data catches up.`,
    );
  }
  if (topSoldLines.length === 0 && products.length > 0) {
    dataGaps.push(
      "Invoice line items are empty this month — Maya will plan from product catalog + CRM until line sales appear.",
    );
  }

  const lines: string[] = [];
  lines.push(
    `[COMMERCE for Maya · ${monthLabel} · business=${ctx.businessId}]`,
  );
  lines.push(
    `Sales MTD (invoices paid + orders done): RM ${combinedMtdMyr.toFixed(2)}` +
      ` (invoices RM ${invoicePaidMtdMyr.toFixed(2)}, orders RM ${ordersDoneMtdMyr.toFixed(2)})`,
  );
  lines.push(
    `Sales ${prevMonthLabel}: RM ${combinedPrevMyr.toFixed(2)}` +
      (salesDeltaPct === null
        ? " (no prior month baseline)"
        : ` (Δ ${salesDeltaPct > 0 ? "+" : ""}${salesDeltaPct}%)`),
  );
  lines.push(`Active products in catalog: ${products.length}`);

  if (topProducts.length > 0) {
    lines.push("Product catalog (sample):");
    for (const p of topProducts) {
      lines.push(
        `  · ${p.name}${p.category ? ` [${p.category}]` : ""} — RM ${p.price_myr.toFixed(2)}`,
      );
    }
  }

  if (topSoldLines.length > 0) {
    lines.push(`Top sold lines (${monthLabel}):`);
    for (const s of topSoldLines) {
      lines.push(
        `  · ${s.description} — qty ${s.qty}, RM ${s.revenue_myr.toFixed(2)}`,
      );
    }
  }

  if (slowCatalogHints.length > 0 && topSoldLines.length > 0) {
    lines.push("Catalog items not seen in this month's invoice lines (possible slow movers):");
    for (const name of slowCatalogHints) {
      lines.push(`  · ${name}`);
    }
  }

  if (ordersMtd.length > 0) {
    lines.push(`Completed orders this month: ${ordersMtd.length}`);
    for (const o of ordersMtd.slice(0, 5)) {
      lines.push(
        `  · ${o.title} — RM ${Number(o.amount_myr ?? 0).toFixed(2)}`,
      );
    }
  }

  if (dataGaps.length > 0) {
    lines.push("Data gaps:");
    for (const g of dataGaps) {
      lines.push(`  · ${g}`);
    }
  }

  lines.push(
    "Note: Dedicated POS line-item tables are not fully wired yet — Operations completed orders are the counter/POS sales proxy alongside Finance paid invoices.",
  );

  return {
    monthLabel,
    prevMonthLabel,
    invoicePaidMtdMyr,
    invoicePaidPrevMyr,
    ordersDoneMtdMyr,
    ordersDonePrevMyr,
    combinedMtdMyr,
    combinedPrevMyr,
    salesDeltaPct,
    productCount: products.length,
    topProducts,
    topSoldLines,
    slowCatalogHints,
    dataGaps,
    text: lines.join("\n"),
  };
}
