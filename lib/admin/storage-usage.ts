import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminFileUsageType =
  | "compliance"
  | "hr"
  | "task"
  | "finance"
  | "finance_invoice"
  | "operations_supplier"
  | "operations_order"
  | "operations_product"
  | "sales_lead";

export interface AdminFileUsageLink {
  type: AdminFileUsageType;
  id: string;
  label: string;
  href: string;
}

export type AdminFileUsageMap = Record<string, AdminFileUsageLink[]>;

export const USAGE_LINK_TYPE_LABELS: Record<AdminFileUsageType, string> = {
  compliance: "Licence",
  hr: "HR",
  task: "Task",
  finance: "Expense",
  finance_invoice: "Invoice",
  operations_supplier: "Supplier",
  operations_order: "Order",
  operations_product: "Product spec",
  sales_lead: "Lead",
};

export async function loadFileUsageLinks(
  supabase: SupabaseClient,
  businessId: string,
  fileIds: string[],
): Promise<AdminFileUsageMap> {
  const map: AdminFileUsageMap = {};
  if (fileIds.length === 0) return map;

  const [
    complianceRes,
    hrRes,
    tasksRes,
    financeRes,
    invoicesRes,
    suppliersRes,
    ordersRes,
    productsRes,
    leadsRes,
  ] = await Promise.all([
    supabase
      .from("admin_compliance_items")
      .select("id, title, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("hr_employee_documents")
      .select(
        "id, label, admin_file_id, employee:hr_employees!inner(id, full_name)",
      )
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("admin_tasks")
      .select("id, title, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("finance_transactions")
      .select("id, description, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("finance_invoices")
      .select("id, number, customer_name, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("operations_suppliers")
      .select("id, name, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("operations_orders")
      .select("id, title, number, admin_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("admin_file_id", fileIds),
    supabase
      .from("operations_products")
      .select("id, name, spec_file_id")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .in("spec_file_id", fileIds),
    supabase
      .from("sales_leads")
      .select("id, name, admin_file_id")
      .eq("business_id", businessId)
      .in("admin_file_id", fileIds),
  ]);

  for (const row of (complianceRes.data ?? []) as Array<{
    id: string;
    title: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "compliance",
      id: row.id,
      label: row.title,
      href: `/admin/compliance?item=${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (hrRes.data ?? []) as Array<{
    id: string;
    label: string;
    admin_file_id: string | null;
    employee: { id: string; full_name: string } | { id: string; full_name: string }[];
  }>) {
    if (!row.admin_file_id) continue;
    const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "hr",
      id: row.id,
      label: emp ? `${emp.full_name} · ${row.label}` : row.label,
      href: emp ? `/hr/employees/${emp.id}` : "/hr/employees",
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (tasksRes.data ?? []) as Array<{
    id: string;
    title: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "task",
      id: row.id,
      label: row.title,
      href: `/admin/tasks?task=${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (financeRes.data ?? []) as Array<{
    id: string;
    description: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "finance",
      id: row.id,
      label: row.description,
      href: `/finance/expenses?txn=${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (invoicesRes.data ?? []) as Array<{
    id: string;
    number: string;
    customer_name: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "finance_invoice",
      id: row.id,
      label: `${row.number} · ${row.customer_name}`,
      href: `/finance/invoices/${row.id}/edit`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (suppliersRes.data ?? []) as Array<{
    id: string;
    name: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "operations_supplier",
      id: row.id,
      label: row.name,
      href: `/operations/suppliers?supplier=${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (ordersRes.data ?? []) as Array<{
    id: string;
    title: string;
    number: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "operations_order",
      id: row.id,
      label: `${row.number} · ${row.title}`,
      href: `/operations/orders?order=${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  for (const row of (productsRes.data ?? []) as Array<{
    id: string;
    name: string;
    spec_file_id: string | null;
  }>) {
    if (!row.spec_file_id) continue;
    const links = map[row.spec_file_id] ?? [];
    links.push({
      type: "operations_product",
      id: row.id,
      label: row.name,
      href: `/operations/products?product=${row.id}`,
    });
    map[row.spec_file_id] = links;
  }

  for (const row of (leadsRes.data ?? []) as Array<{
    id: string;
    name: string;
    admin_file_id: string | null;
  }>) {
    if (!row.admin_file_id) continue;
    const links = map[row.admin_file_id] ?? [];
    links.push({
      type: "sales_lead",
      id: row.id,
      label: row.name,
      href: `/sales/leads/${row.id}`,
    });
    map[row.admin_file_id] = links;
  }

  return map;
}

/** Categories businesses often expect on file — used by Amir attention items. */
export const EXPECTED_STORAGE_CATEGORIES = [
  { key: "contract", label: "contract PDF" },
  { key: "receipt", label: "receipt samples" },
  { key: "compliance", label: "compliance backup documents" },
] as const;

export async function loadMissingStorageCategories(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Array<{ key: string; label: string }>> {
  const { data } = await supabase
    .from("admin_files")
    .select("category")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  const present = new Set(
    (data ?? [])
      .map((r) => (r as { category: string | null }).category)
      .filter(Boolean),
  );

  return EXPECTED_STORAGE_CATEGORIES.filter((c) => !present.has(c.key));
}
