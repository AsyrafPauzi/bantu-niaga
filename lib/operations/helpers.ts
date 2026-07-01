import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperationsSummary } from "@/lib/operations/schemas";

export async function nextOperationsOrderNumber(
  admin: SupabaseClient,
  businessId: string,
  prefix = "ORD",
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;
  const { data } = await admin
    .from("operations_orders")
    .select("number")
    .eq("business_id", businessId)
    .like("number", `${pattern}%`)
    .order("number", { ascending: false })
    .limit(1);

  const last = (data?.[0] as { number: string } | undefined)?.number;
  let seq = 1;
  if (last?.startsWith(pattern)) {
    const tail = parseInt(last.slice(pattern.length), 10);
    if (Number.isFinite(tail)) seq = tail + 1;
  }
  return `${pattern}${String(seq).padStart(4, "0")}`;
}

function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function computeOperationsSummary(
  admin: SupabaseClient,
  businessId: string,
): Promise<OperationsSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStartDate = monthStart();

  const { data: orders } = await admin
    .from("operations_orders")
    .select("status, due_date, completed_at")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  let todo_count = 0;
  let in_progress_count = 0;
  let done_this_month = 0;
  let overdue_count = 0;

  for (const row of (orders ?? []) as Array<{
    status: string;
    due_date: string | null;
    completed_at: string | null;
  }>) {
    if (row.status === "todo") {
      todo_count++;
      if (row.due_date && row.due_date < today) overdue_count++;
    } else if (row.status === "in_progress") {
      in_progress_count++;
      if (row.due_date && row.due_date < today) overdue_count++;
    } else if (row.status === "done") {
      const doneAt = row.completed_at?.slice(0, 10);
      if (doneAt && doneAt >= monthStartDate) done_this_month++;
    }
  }

  const { count: supplier_count } = await admin
    .from("operations_suppliers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("deleted_at", null);

  return {
    open_orders: todo_count + in_progress_count,
    todo_count,
    in_progress_count,
    done_this_month,
    supplier_count: supplier_count ?? 0,
    overdue_count,
  };
}
