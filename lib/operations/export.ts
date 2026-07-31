import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(",");
}

export async function buildOperationsExportCsv(
  businessId: string,
  opts?: { from?: string; to?: string },
): Promise<string> {
  const admin = createServiceRoleClient();

  let ordersQuery = admin
    .from("operations_orders")
    .select(
      "number, customer_name, title, status, fulfillment_type, fulfillment_status, due_date, amount_myr, notes, created_at",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let bookingsQuery = admin
    .from("operations_bookings")
    .select(
      "number, customer_name, service_title, status, starts_at, ends_at, amount_myr, notes",
    )
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });

  if (opts?.from) {
    ordersQuery = ordersQuery.gte("created_at", `${opts.from}T00:00:00.000Z`);
    bookingsQuery = bookingsQuery.gte("starts_at", `${opts.from}T00:00:00.000Z`);
  }
  if (opts?.to) {
    ordersQuery = ordersQuery.lte("created_at", `${opts.to}T23:59:59.999Z`);
    bookingsQuery = bookingsQuery.lte("starts_at", `${opts.to}T23:59:59.999Z`);
  }

  const [ordersRes, productsRes, bookingsRes] = await Promise.all([
    ordersQuery,
    admin
      .from("operations_products")
      .select("sku, name, category, price_myr, stock_qty, low_stock_threshold, is_active")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    bookingsQuery,
  ]);

  const lines: string[] = [
    "# Bantu Niaga — Operations export",
    `# Generated: ${new Date().toISOString()}`,
    "",
    "## Orders",
    csvRow([
      "Number",
      "Customer",
      "Title",
      "Status",
      "Fulfillment",
      "Fulfillment status",
      "Due date",
      "Amount MYR",
      "Notes",
      "Created",
    ]),
  ];

  for (const row of ordersRes.data ?? []) {
    lines.push(
      csvRow([
        row.number,
        row.customer_name,
        row.title,
        row.status,
        row.fulfillment_type,
        row.fulfillment_status,
        row.due_date,
        row.amount_myr,
        row.notes,
        row.created_at,
      ]),
    );
  }

  lines.push("", "## Products", csvRow(["SKU", "Name", "Category", "Price MYR", "Stock", "Low threshold", "Active"]));
  for (const row of productsRes.data ?? []) {
    lines.push(
      csvRow([
        row.sku,
        row.name,
        row.category,
        row.price_myr,
        row.stock_qty,
        row.low_stock_threshold,
        row.is_active ? "yes" : "no",
      ]),
    );
  }

  lines.push(
    "",
    "## Bookings",
    csvRow(["Number", "Customer", "Service", "Status", "Starts", "Ends", "Amount MYR", "Notes"]),
  );
  for (const row of bookingsRes.data ?? []) {
    lines.push(
      csvRow([
        row.number,
        row.customer_name,
        row.service_title,
        row.status,
        row.starts_at,
        row.ends_at,
        row.amount_myr,
        row.notes,
      ]),
    );
  }

  return lines.join("\n");
}
