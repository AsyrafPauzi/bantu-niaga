import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BusinessRow {
  id: string;
  idcompany: string;
  name: string;
  tier: "starter" | "micro" | "sme" | "enterprise";
  state_code: string | null;
  sst_enabled: boolean;
  sst_rate_pct: number;
  logo_url: string | null;
  brand_primary_hex: string;
  brand_accent_hex: string;
  registration_no: string | null;
  sst_number: string | null;
  contact_line: string | null;
  receipt_footer: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
  subscription_status: "active" | "past_due" | "cancelled" | "trial";
  subscription_renewal_at: string | null;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

const BUSINESS_SELECT =
  "id, idcompany, name, tier, state_code, sst_enabled, sst_rate_pct, " +
  "logo_url, brand_primary_hex, brand_accent_hex, registration_no, " +
  "sst_number, contact_line, receipt_footer, email_from_name, " +
  "email_reply_to, subscription_status, subscription_renewal_at, " +
  "credit_balance, created_at, updated_at";

export async function loadBusiness(businessId: string): Promise<BusinessRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as BusinessRow;
}

export { BUSINESS_SELECT };
