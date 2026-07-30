import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

export interface FinanceCustomerStats {
  invoice_count: number;
  quote_count: number;
  unpaid_myr: number;
  total_billed_myr: number;
  last_invoice_date: string | null;
}

export interface FinanceCustomerWithStats extends FinanceCustomerRow {
  stats: FinanceCustomerStats;
}

export interface FinanceCustomersSummary {
  total: number;
  with_contact: number;
  outstanding_myr: number;
  active_billers: number;
}

const EMPTY_STATS: FinanceCustomerStats = {
  invoice_count: 0,
  quote_count: 0,
  unpaid_myr: 0,
  total_billed_myr: 0,
  last_invoice_date: null,
};

const CUSTOMER_SELECT =
  "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at";

function attachStats(
  customers: FinanceCustomerRow[],
  statsByCustomer: Map<string, FinanceCustomerStats>,
): FinanceCustomerWithStats[] {
  return customers.map((customer) => ({
    ...customer,
    stats: statsByCustomer.get(customer.id) ?? { ...EMPTY_STATS },
  }));
}

async function loadStatsForCustomers(
  supabase: SupabaseClient,
  businessId: string,
  customerIds: string[],
): Promise<Map<string, FinanceCustomerStats>> {
  const statsByCustomer = new Map<string, FinanceCustomerStats>();
  if (customerIds.length === 0) return statsByCustomer;

  const { data, error } = await supabase
    .from("finance_invoices")
    .select("customer_id, total_myr, status, invoice_date, document_kind")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .neq("status", "void")
    .in("customer_id", customerIds);

  if (error) throw error;

  for (const inv of data ?? []) {
    const customerId = inv.customer_id as string;
    const current = statsByCustomer.get(customerId) ?? { ...EMPTY_STATS };
    const total = Number(inv.total_myr) || 0;
    const isQuote = inv.document_kind === "quote";

    if (isQuote) {
      current.quote_count += 1;
    } else {
      current.invoice_count += 1;
      current.total_billed_myr += total;
      if (inv.status === "sent") current.unpaid_myr += total;
    }

    const invDate = inv.invoice_date as string | null;
    if (
      invDate &&
      (!current.last_invoice_date || invDate > current.last_invoice_date)
    ) {
      current.last_invoice_date = invDate;
    }

    statsByCustomer.set(customerId, current);
  }

  return statsByCustomer;
}

export async function loadFinanceCustomersSummary(
  supabase: SupabaseClient,
  businessId: string,
): Promise<FinanceCustomersSummary> {
  const [totalRes, contactRes, invoicesRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .or("phone_e164.not.is.null,email.not.is.null"),
    supabase
      .from("finance_invoices")
      .select("customer_id, total_myr, status, document_kind")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "void")
      .not("customer_id", "is", null),
  ]);

  if (totalRes.error) throw totalRes.error;
  if (contactRes.error) throw contactRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  let outstanding_myr = 0;
  const activeIds = new Set<string>();

  for (const inv of invoicesRes.data ?? []) {
    const customerId = inv.customer_id as string;
    activeIds.add(customerId);
    if (inv.document_kind === "invoice" && inv.status === "sent") {
      outstanding_myr += Number(inv.total_myr) || 0;
    }
  }

  return {
    total: totalRes.count ?? 0,
    with_contact: contactRes.count ?? 0,
    outstanding_myr,
    active_billers: activeIds.size,
  };
}

export async function loadFinanceCustomersPage(
  supabase: SupabaseClient,
  businessId: string,
  options: { from: number; to: number; q?: string },
): Promise<{ customers: FinanceCustomerWithStats[]; total: number }> {
  let query = supabase
    .from("customers")
    .select(CUSTOMER_SELECT, { count: "exact" })
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .range(options.from, options.to);

  const q = options.q?.trim();
  if (q) {
    const safe = q.replace(/[%_\\]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,email.ilike.%${safe}%,phone_e164.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as FinanceCustomerRow[];
  const statsByCustomer = await loadStatsForCustomers(
    supabase,
    businessId,
    rows.map((c) => c.id),
  );

  return {
    customers: attachStats(rows, statsByCustomer),
    total: count ?? rows.length,
  };
}
