import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUseLeads } from "@/lib/sales/access";
import { leadNoteCreateSchema } from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/sales/leads/[id]/notes — append note. */
export async function POST(request: Request, context: RouteContext) {
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

  const { id: leadId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leadNoteCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("sales_leads")
    .select("id")
    .eq("id", leadId)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json(
      { error: "load_failed", message: leadError.message },
      { status: 500 },
    );
  }
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("sales_lead_notes")
    .insert({
      business_id: user.businessId,
      lead_id: leadId,
      body: parsed.body,
      created_by: user.id,
    })
    .select("id, body, created_by, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "create_failed", message: error?.message ?? "Could not add note" },
      { status: 500 },
    );
  }

  // Bump lead updated_at for list sorting.
  await supabase
    .from("sales_leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("business_id", user.businessId);

  return NextResponse.json({ data }, { status: 201 });
}
