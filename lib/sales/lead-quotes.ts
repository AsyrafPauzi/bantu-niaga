import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadQuoteRow } from "@/lib/sales/lead-quotes-shared";

export type { LeadQuoteRow } from "@/lib/sales/lead-quotes-shared";

/** Match Finance quotes to a lead by phone or name. */
export async function loadLeadQuotes(
  supabase: SupabaseClient,
  businessId: string,
  opts: { name: string; phone_e164: string },
): Promise<LeadQuoteRow[]> {
  const phone = opts.phone_e164.trim();
  const name = opts.name.trim().toLowerCase();

  const { data, error } = await supabase
    .from("finance_invoices")
    .select(
      "id, number, share_hash, customer_name, customer_phone, total_myr, status, created_at",
    )
    .eq("business_id", businessId)
    .eq("document_kind", "quote")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as Array<LeadQuoteRow & { customer_phone?: string | null }>)
    .filter((q) => {
      if (phone && q.customer_phone === phone) return true;
      if (name && q.customer_name.toLowerCase().includes(name)) return true;
      return false;
    })
    .slice(0, 5)
    .map(({ customer_phone: _p, ...rest }) => rest);
}
