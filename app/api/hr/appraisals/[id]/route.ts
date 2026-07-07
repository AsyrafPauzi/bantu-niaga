import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { requireStaffAppraisalAccess } from "@/lib/hr/require-appraisal-addon";
import { appraisalUpdateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireStaffAppraisalAccess();
  if (response) return response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = appraisalUpdateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const patch: Record<string, unknown> = {};
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.rating !== undefined) patch.rating = parsed.rating;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;
  if (parsed.due_date !== undefined) patch.due_date = parsed.due_date;

  if (parsed.status === "completed") {
    patch.completed_by = user.id;
    patch.completed_at = new Date().toISOString();
  } else if (parsed.status === "pending") {
    patch.completed_by = null;
    patch.completed_at = null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_staff_appraisals")
    .update(patch)
    .eq("business_id", user.businessId)
    .eq("id", id)
    .select(
      "id, employee_id, period_label, due_date, status, rating, notes, completed_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: "Could not update appraisal." },
      { status: 500 },
    );
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.appraisal.update",
    entityType: "hr_staff_appraisals",
    entityId: id,
    diff: parsed,
  });

  return NextResponse.json({ item: data }, { status: 200 });
}
