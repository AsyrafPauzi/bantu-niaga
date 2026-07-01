import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicFinanceInvoice {
  id: string;
  number: string;
  share_hash: string;
  customer_name: string;
  description: string | null;
  amount_myr: number;
  tax_myr: number;
  total_myr: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  business: {
    id: string;
    idcompany: string;
    name: string;
    duitnow_id: string | null;
    sst_enabled: boolean;
    sst_rate_pct: number;
  };
}

export async function loadPublicFinanceInvoice(
  idcompany: string,
  shareHash: string,
): Promise<PublicFinanceInvoice | null> {
  const admin = createServiceRoleClient();

  const { data: business } = await admin
    .from("businesses")
    .select(
      "id, idcompany, name, duitnow_id, sst_enabled, sst_rate_pct",
    )
    .eq("idcompany", idcompany)
    .maybeSingle();

  if (!business) return null;

  const biz = business as PublicFinanceInvoice["business"] & { id: string };

  const { data: invoice } = await admin
    .from("finance_invoices")
    .select(
      "id, number, share_hash, customer_name, description, amount_myr, tax_myr, " +
        "total_myr, status, due_date, paid_at",
    )
    .eq("business_id", biz.id)
    .eq("share_hash", shareHash)
    .is("deleted_at", null)
    .neq("status", "void")
    .maybeSingle();

  if (!invoice) return null;

  const row = invoice as unknown as Omit<PublicFinanceInvoice, "business">;

  return {
    ...row,
    business: biz,
  };
}
