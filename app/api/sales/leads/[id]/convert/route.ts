import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads } from "@/lib/sales/access";
import { convertLeadToCustomer } from "@/lib/sales/convert-lead";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/sales/leads/[id]/convert — link/create Marketing customer. */
export async function POST(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canUseLeads(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: lead, error } = await supabase
    .from("sales_leads")
    .select("id, name, phone_e164, customer_id, status")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const result = await convertLeadToCustomer({
      businessId: user.businessId,
      leadId: lead.id,
      name: lead.name,
      phoneE164: lead.phone_e164,
      existingCustomerId: lead.customer_id,
      actorUserId: user.id,
    });

    await supabase.from("audit_log").insert({
      business_id: user.businessId,
      actor_user_id: user.id,
      action: "sales.lead.convert",
      entity_type: "sales_lead",
      entity_id: lead.id,
      diff: {
        customer_id: result.customerId,
        action: result.action,
      },
    });

    return NextResponse.json(
      {
        customer_id: result.customerId,
        action: result.action,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("sales.lead.convert", e);
    return NextResponse.json(
      {
        error: "convert_failed",
        message: "Could not convert this lead. Try again.",
      },
      { status: 500 },
    );
  }
}
