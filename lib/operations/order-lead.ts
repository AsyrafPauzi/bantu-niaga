import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { notifySalesLeadCreated } from "@/lib/sales/notify";

export type CreateLeadFromOrderResult =
  | { ok: true; leadId: string; created: boolean; href: string }
  | {
      ok: false;
      reason: "not_found" | "no_phone" | "forbidden" | "create_failed";
    };

/** Create (or return existing) sales lead linked to an operations order. */
export async function createLeadFromOrder(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    orderId: string;
    userId: string;
    canLeads: boolean;
  },
): Promise<CreateLeadFromOrderResult> {
  if (!opts.canLeads) {
    return { ok: false, reason: "forbidden" };
  }

  const { data: existingLead } = await supabase
    .from("sales_leads")
    .select("id")
    .eq("business_id", opts.businessId)
    .eq("source_order_id", opts.orderId)
    .maybeSingle();

  if (existingLead) {
    const leadId = existingLead.id as string;
    return {
      ok: true,
      leadId,
      created: false,
      href: `/sales/leads/${leadId}`,
    };
  }

  const { data: order, error: orderErr } = await supabase
    .from("operations_orders")
    .select("id, number, customer_name, customer_phone, title, amount_myr")
    .eq("business_id", opts.businessId)
    .eq("id", opts.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, reason: "not_found" };
  }

  const phoneRaw = (order.customer_phone as string | null)?.trim() ?? "";
  const phoneE164 = phoneRaw ? normalizeMyPhone(phoneRaw) : null;
  if (!phoneE164) {
    return { ok: false, reason: "no_phone" };
  }

  const interest = `Order ${order.number}: ${order.title}`;
  const estimated =
    order.amount_myr != null ? Number(order.amount_myr) : null;

  const { data: lead, error: leadErr } = await supabase
    .from("sales_leads")
    .insert({
      business_id: opts.businessId,
      name: order.customer_name as string,
      phone_e164: phoneE164,
      channel: "other",
      interest,
      estimated_value_myr: estimated,
      assigned_to: opts.userId,
      source_order_id: opts.orderId,
      status: "new",
    })
    .select("id, name")
    .single();

  if (leadErr || !lead) {
    return { ok: false, reason: "create_failed" };
  }

  notifySalesLeadCreated({
    businessId: opts.businessId,
    leadId: lead.id as string,
    name: lead.name as string,
  });

  return {
    ok: true,
    leadId: lead.id as string,
    created: true,
    href: `/sales/leads/${lead.id}`,
  };
}
