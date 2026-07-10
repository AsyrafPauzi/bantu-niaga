import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeMyPhone } from "@/lib/marketing/phone";

/**
 * Convert a sales lead → Marketing customer.
 *
 * Phase B rule: if phone already exists on a live customer in this
 * business, always link that row (even when names differ). Only create
 * when there is no phone match.
 */

export type LeadConvertAction = "linked" | "created" | "already_converted";

export interface LeadConvertResult {
  customerId: string;
  action: LeadConvertAction;
}

export async function convertLeadToCustomer(opts: {
  businessId: string;
  leadId: string;
  name: string;
  phoneE164: string;
  existingCustomerId: string | null;
  actorUserId: string;
}): Promise<LeadConvertResult> {
  if (!opts.businessId) {
    throw new Error("convertLeadToCustomer: businessId required");
  }
  if (opts.existingCustomerId) {
    return {
      customerId: opts.existingCustomerId,
      action: "already_converted",
    };
  }

  const phone =
    normalizeMyPhone(opts.phoneE164) ??
    (opts.phoneE164.startsWith("+") ? opts.phoneE164 : null);
  if (!phone) {
    throw new Error("convertLeadToCustomer: invalid phone");
  }

  const supabase = createServiceRoleClient();

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", opts.businessId)
    .eq("phone_e164", phone)
    .is("merged_into_id", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`convertLeadToCustomer: lookup failed: ${findError.message}`);
  }

  let customerId: string;
  let action: LeadConvertAction;

  if (existing?.id) {
    customerId = existing.id;
    action = "linked";
  } else {
    const { data, error } = await supabase.rpc("marketing_create_customer", {
      p_business_id: opts.businessId,
      p_name: opts.name.trim(),
      p_phone_e164: phone,
      p_email: null,
      p_address: null,
      p_manual_tags: [],
      p_notes: null,
      p_source: "lead_conversion",
      p_created_by_user_id: opts.actorUserId,
    });
    if (error) {
      throw new Error(`convertLeadToCustomer: create failed: ${error.message}`);
    }
    const row = Array.isArray(data)
      ? data[0]
      : (data as { customer_id?: string } | null);
    if (!row?.customer_id || typeof row.customer_id !== "string") {
      throw new Error("convertLeadToCustomer: RPC returned no customer id");
    }
    customerId = row.customer_id;
    action = "created";
  }

  const { error: updateError } = await supabase
    .from("sales_leads")
    .update({
      customer_id: customerId,
      converted_at: new Date().toISOString(),
      status: "won",
    })
    .eq("id", opts.leadId)
    .eq("business_id", opts.businessId);

  if (updateError) {
    throw new Error(`convertLeadToCustomer: lead update failed: ${updateError.message}`);
  }

  return { customerId, action };
}

/** Validate assignee is an active member with a lead-capable role. */
export async function assertLeadAssignee(opts: {
  businessId: string;
  userId: string;
}): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("user_business_memberships")
    .select("user_id, role")
    .eq("business_id", opts.businessId)
    .eq("user_id", opts.userId)
    .maybeSingle();

  if (error || !data) return false;
  return ["owner", "manager", "sales_rep"].includes(data.role);
}
