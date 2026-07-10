import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads } from "@/lib/sales/access";
import { assertLeadAssignee } from "@/lib/sales/convert-lead";
import { leadUpdateSchema, normalizeFollowUpAt } from "@/lib/sales/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const LEAD_SELECT =
  "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, converted_at, lost_reason, created_by, created_at, updated_at";

/** GET /api/sales/leads/[id] */
export async function GET(_request: Request, context: RouteContext) {
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

  const [leadRes, notesRes] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(LEAD_SELECT)
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("sales_lead_notes")
      .select("id, body, created_by, created_at")
      .eq("lead_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false }),
  ]);

  if (leadRes.error) {
    return NextResponse.json(
      { error: "load_failed", message: leadRes.error.message },
      { status: 500 },
    );
  }
  if (!leadRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: leadRes.data,
      notes: notesRes.data ?? [],
    },
    { status: 200 },
  );
}

/** PATCH /api/sales/leads/[id] */
export async function PATCH(request: Request, context: RouteContext) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leadUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.channel !== undefined) patch.channel = parsed.channel;
  if (parsed.interest !== undefined) patch.interest = parsed.interest;
  if (parsed.estimated_value_myr !== undefined) {
    patch.estimated_value_myr = parsed.estimated_value_myr;
  }
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.follow_up_at !== undefined) {
    patch.follow_up_at = normalizeFollowUpAt(parsed.follow_up_at) ?? null;
  }
  if (parsed.lost_reason !== undefined) patch.lost_reason = parsed.lost_reason;

  if (parsed.phone !== undefined) {
    const phoneE164 = normalizeMyPhone(parsed.phone);
    if (!phoneE164) {
      return NextResponse.json(
        {
          error: "invalid_phone",
          message: "Enter a valid Malaysian or E.164 phone number.",
        },
        { status: 400 },
      );
    }
    patch.phone_e164 = phoneE164;
  }

  if (parsed.assigned_to !== undefined) {
    if (parsed.assigned_to === null) {
      patch.assigned_to = null;
    } else {
      const ok = await assertLeadAssignee({
        businessId: user.businessId,
        userId: parsed.assigned_to,
      });
      if (!ok) {
        return NextResponse.json(
          {
            error: "invalid_assignee",
            message: "Assignee must be a team member with sales access.",
          },
          { status: 400 },
        );
      }
      patch.assigned_to = parsed.assigned_to;
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .select(LEAD_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "sales.lead.update",
    entity_type: "sales_lead",
    entity_id: id,
    diff: patch,
  });

  return NextResponse.json({ data }, { status: 200 });
}
