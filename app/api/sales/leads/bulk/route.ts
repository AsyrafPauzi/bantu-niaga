import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { assertLeadAssignee } from "@/lib/sales/convert-lead";
import { canUseLeads } from "@/lib/sales/access";
import { LEAD_STATUSES } from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bulkSchema = z
  .object({
    lead_ids: z.array(z.string().uuid()).min(1).max(50),
    status: z.enum(LEAD_STATUSES).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    unassign: z.boolean().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.assigned_to !== undefined || v.unassign,
    { message: "Provide status, assigned_to, or unassign" },
  );

/** PATCH /api/sales/leads/bulk — bulk status or assignee update. */
export async function PATCH(request: Request) {
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
    parsed = bulkSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  if (parsed.assigned_to) {
    const ok = await assertLeadAssignee({
      businessId: user.businessId,
      userId: parsed.assigned_to,
    });
    if (!ok) {
      return NextResponse.json({ error: "invalid_assignee" }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (parsed.status) patch.status = parsed.status;
  if (parsed.unassign) patch.assigned_to = null;
  else if (parsed.assigned_to) patch.assigned_to = parsed.assigned_to;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .update(patch)
    .eq("business_id", user.businessId)
    .in("id", parsed.lead_ids)
    .select("id, name, status, assigned_to");

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { updated: data?.length ?? 0, leads: data ?? [] },
    { status: 200 },
  );
}
