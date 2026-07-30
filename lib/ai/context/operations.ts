import "server-only";

import { createAgentScopedClient } from "./client";
import type {
  AgentContext,
  PillarSnapshot,
  SnapshotAttention,
  SnapshotItem,
  SnapshotKpi,
} from "./types";

/**
 * Operations snapshot for Aiman / Boardroom — products, orders, bookings.
 */
export async function buildOperationsSnapshot(
  ctx: AgentContext,
): Promise<PillarSnapshot> {
  const supabase = await createAgentScopedClient(ctx);
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const [productsRes, ordersRes, bookingsRes, suppliersRes] = await Promise.all([
    supabase
      .from("operations_products")
      .select("id, sku, name, category, price_myr, is_active")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("operations_orders")
      .select("id, number, title, customer_name, status, due_date, amount_myr, created_at")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(25),
    supabase
      .from("operations_bookings")
      .select(
        "id, number, customer_name, service_title, status, starts_at, ends_at, amount_myr",
      )
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .gte("starts_at", nowIso)
      .in("status", ["held", "confirmed"])
      .order("starts_at", { ascending: true })
      .limit(12),
    supabase
      .from("operations_suppliers")
      .select("id, name")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(10),
  ]);

  const products = productsRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];

  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

  const todoOrders = orders.filter((o) => o.status === "todo");
  const inProgressOrders = orders.filter((o) => o.status === "in_progress");
  const doneOrders = orders.filter((o) => o.status === "done");
  const overdueOrders = [...todoOrders, ...inProgressOrders].filter(
    (o) => o.due_date && String(o.due_date) < today,
  );

  const attention: SnapshotAttention[] = [];
  if (overdueOrders.length > 0) {
    attention.push({
      id: "overdue_orders",
      label: `${overdueOrders.length} open order(s) past due`,
      severity: "high",
    });
  }
  if (activeProducts.length === 0 && products.length > 0) {
    attention.push({
      id: "no_active_products",
      label: "No active products — reactivate catalog for POS and orders",
      severity: "medium",
    });
  }
  if (products.length === 0) {
    attention.push({
      id: "no_products",
      label: "No products in catalog yet",
      severity: "low",
    });
  }
  if (bookings.length === 0 && orders.length === 0) {
    attention.push({
      id: "quiet_ops",
      label: "No upcoming bookings or recent orders",
      severity: "low",
    });
  }

  const recent: SnapshotItem[] = [
    ...overdueOrders.slice(0, 3).map((o) => ({
      id: o.id as string,
      label: `Overdue: ${String(o.number)}`,
      meta: `${o.customer_name} · ${o.title}`,
      at: (o.due_date as string) ?? (o.created_at as string),
    })),
    ...bookings.slice(0, 4).map((b) => ({
      id: b.id as string,
      label: `Booking: ${String(b.service_title)}`,
      meta: `${b.customer_name} · ${b.status}`,
      at: b.starts_at as string,
    })),
    ...activeProducts.slice(0, 3).map((p) => ({
      id: p.id as string,
      label: `${p.sku} · ${p.name}`,
      meta: `RM ${Number(p.price_myr ?? 0).toFixed(2)}${p.category ? ` · ${p.category}` : ""}`,
      at: undefined,
    })),
  ].slice(0, 10);

  const kpis: SnapshotKpi[] = [
    { key: "products_active", label: "Active products", value: activeProducts.length },
    { key: "products_total", label: "Products (loaded)", value: products.length },
    { key: "orders_open", label: "Open orders", value: todoOrders.length + inProgressOrders.length },
    { key: "orders_todo", label: "To do", value: todoOrders.length },
    { key: "orders_in_progress", label: "In progress", value: inProgressOrders.length },
    { key: "orders_done", label: "Done (recent)", value: doneOrders.length },
    { key: "orders_overdue", label: "Overdue orders", value: overdueOrders.length },
    { key: "bookings_upcoming", label: "Upcoming bookings", value: bookings.length },
    { key: "suppliers", label: "Suppliers", value: suppliers.length },
  ];

  const available =
    products.length > 0 || orders.length > 0 || bookings.length > 0;

  const productSample = activeProducts
    .slice(0, 6)
    .map((p) => p.name)
    .join(", ");

  return {
    pillar: "operations",
    businessId: ctx.businessId,
    generatedAt: new Date().toISOString(),
    available,
    headline: available
      ? `Operations: ${activeProducts.length} active products · ${todoOrders.length + inProgressOrders.length} open orders · ${bookings.length} upcoming bookings`
      : "No operations data yet — add products, orders, or bookings.",
    kpis,
    recent,
    attention,
    notes: available
      ? `Active catalog sample: ${productSample || "none"}. Inactive products: ${inactiveProducts.length}.`
      : "Thin data — add products and log orders so Aiman can advise better.",
  };
}
