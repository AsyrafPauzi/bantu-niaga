import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads } from "@/lib/sales/access";
import {
  assertLeadAssignee,
} from "@/lib/sales/convert-lead";
import {
  leadCreateSchema,
  LEAD_STATUSES,
  malaysiaDayBounds,
  malaysiaTodayYmd,
  normalizeFollowUpAt,
} from "@/lib/sales/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/sales/leads — list with filters. */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status");
  const followUp = url.searchParams.get("follow_up");
  const mine = url.searchParams.get("mine") === "1";
  const assignedTo = url.searchParams.get("assigned_to");
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
  );

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("sales_leads")
    .select(
      "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, converted_at, lost_reason, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (mine) {
    query = query.eq("assigned_to", user.id);
  } else if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { dayStartIso, dayEndIso } = malaysiaDayBounds(malaysiaTodayYmd());
  if (followUp === "due_today") {
    query = query
      .gte("follow_up_at", dayStartIso)
      .lt("follow_up_at", dayEndIso);
  } else if (followUp === "overdue") {
    query = query
      .not("follow_up_at", "is", null)
      .lt("follow_up_at", dayStartIso)
      .not("status", "in", "(won,lost)");
  }

  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    if (safe.length > 0) {
      query = query.or(
        `name.ilike.%${safe}%,phone_e164.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

/** POST /api/sales/leads — create lead. */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leadCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

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

  if (parsed.assigned_to) {
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
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      phone_e164: phoneE164,
      channel: parsed.channel ?? null,
      interest: parsed.interest ?? null,
      estimated_value_myr: parsed.estimated_value_myr ?? null,
      follow_up_at: normalizeFollowUpAt(parsed.follow_up_at ?? null) ?? null,
      assigned_to: parsed.assigned_to ?? null,
      status: parsed.status ?? "new",
      created_by: user.id,
    })
    .select(
      "id, name, phone_e164, channel, interest, estimated_value_myr, status, follow_up_at, assigned_to, customer_id, converted_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "create_failed", message: error?.message ?? "Could not create lead" },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "sales.lead.create",
    entity_type: "sales_lead",
    entity_id: data.id,
    diff: { name: data.name, phone_e164: data.phone_e164 },
  });

  return NextResponse.json({ data }, { status: 201 });
}
