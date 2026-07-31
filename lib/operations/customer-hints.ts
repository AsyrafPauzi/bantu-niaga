import type { OperationsOrderRow } from "@/lib/operations/schemas";

export interface OperationsCustomerHint {
  name: string;
  phone: string | null;
}

/** Distinct customer names from past orders (most recent first). */
export function customerHintsFromOrders(
  orders: OperationsOrderRow[],
  limit = 30,
): OperationsCustomerHint[] {
  const seen = new Set<string>();
  const out: OperationsCustomerHint[] = [];
  for (const order of orders) {
    const name = order.customer_name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, phone: order.customer_phone });
    if (out.length >= limit) break;
  }
  return out;
}
