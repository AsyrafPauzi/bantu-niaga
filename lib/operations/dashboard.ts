import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOperationsSummary } from "@/lib/operations/helpers";
import type {
  OperationsBookingStatus,
  OperationsOrderStatus,
  OperationsSummary,
} from "@/lib/operations/schemas";

export interface OperationsDashboardOrder {
  id: string;
  number: string;
  customer_name: string;
  title: string;
  status: OperationsOrderStatus;
  due_date: string | null;
  amount_myr: number | null;
}

export interface OperationsDashboardBooking {
  id: string;
  number: string;
  customer_name: string;
  service_title: string;
  starts_at: string;
  ends_at: string;
  status: OperationsBookingStatus;
  resource_name: string | null;
}

export interface OperationsDashboardLowStock {
  id: string;
  sku: string;
  name: string;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface OperationsDashboardWeekStats {
  done_this_week: number;
  done_prev_week: number;
}

export interface OperationsNotificationItem {
  id: string;
  message: string;
  event_type: string;
  created_at: string;
}

export interface OperationsDashboardData {
  summary: OperationsSummary;
  recentOrders: OperationsDashboardOrder[];
  upcomingBookings: OperationsDashboardBooking[];
  todaySchedule: OperationsDashboardBooking[];
  lowStockProducts: OperationsDashboardLowStock[];
  weekStats: OperationsDashboardWeekStats;
  notifications: OperationsNotificationItem[];
}

export async function loadOperationsDashboard(
  admin: SupabaseClient,
  businessId: string,
): Promise<OperationsDashboardData> {
  const summary = await computeOperationsSummary(admin, businessId);
  const now = new Date();
  const nowIso = now.toISOString();
  const todayEnd = new Date(now);
  todayEnd.setHours(todayEnd.getHours() + 8);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [
    ordersRes,
    bookingsRes,
    todayBookingsRes,
    resourcesRes,
    lowStockRes,
    completedOrdersRes,
    notificationsRes,
  ] = await Promise.all([
    admin
      .from("operations_orders")
      .select("id, number, customer_name, title, status, due_date, amount_myr")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    admin
      .from("operations_bookings")
      .select(
        "id, number, customer_name, service_title, starts_at, ends_at, status, resource_id",
      )
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("status", ["held", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(5),
    admin
      .from("operations_bookings")
      .select(
        "id, number, customer_name, service_title, starts_at, ends_at, status, resource_id",
      )
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("status", ["held", "confirmed"])
      .gte("starts_at", nowIso)
      .lte("starts_at", todayEnd.toISOString())
      .order("starts_at", { ascending: true })
      .limit(8),
    admin
      .from("operations_booking_resources")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null),
    admin
      .from("operations_products")
      .select("id, sku, name, stock_qty, low_stock_threshold")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("stock_qty", "is", null)
      .order("stock_qty", { ascending: true })
      .limit(8),
    admin
      .from("operations_orders")
      .select("completed_at")
      .eq("business_id", businessId)
      .eq("status", "done")
      .is("deleted_at", null)
      .not("completed_at", "is", null)
      .gte("completed_at", twoWeeksAgo.toISOString()),
    admin
      .from("business_notifications")
      .select("id, message, event_type, created_at")
      .eq("business_id", businessId)
      .eq("pillar", "operations")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const resourceLookup = new Map(
    (resourcesRes.data ?? []).map((row) => [row.id as string, row.name as string]),
  );

  const lowStockProducts = (lowStockRes.data ?? [])
    .map((row) => ({
      id: row.id as string,
      sku: row.sku as string,
      name: row.name as string,
      stock_qty: row.stock_qty as number,
      low_stock_threshold: (row.low_stock_threshold as number) ?? 5,
    }))
    .filter((row) => row.stock_qty <= row.low_stock_threshold);

  const mapBooking = (row: Record<string, unknown>) => {
    const resourceId = row.resource_id as string | null;
    return {
      id: row.id as string,
      number: row.number as string,
      customer_name: row.customer_name as string,
      service_title: row.service_title as string,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      status: row.status as OperationsBookingStatus,
      resource_name: resourceId ? (resourceLookup.get(resourceId) ?? null) : null,
    };
  };

  const upcomingBookings = (bookingsRes.data ?? []).map((row) =>
    mapBooking(row as Record<string, unknown>),
  );
  const todaySchedule = (todayBookingsRes.data ?? []).map((row) =>
    mapBooking(row as Record<string, unknown>),
  );

  let done_this_week = 0;
  let done_prev_week = 0;
  for (const row of completedOrdersRes.data ?? []) {
    const completedAt = new Date(row.completed_at as string);
    if (completedAt >= weekAgo) {
      done_this_week++;
    } else {
      done_prev_week++;
    }
  }

  return {
    summary,
    recentOrders: (ordersRes.data ?? []) as OperationsDashboardOrder[],
    upcomingBookings,
    todaySchedule,
    lowStockProducts,
    weekStats: { done_this_week, done_prev_week },
    notifications: (notificationsRes.data ?? []) as OperationsNotificationItem[],
  };
}
