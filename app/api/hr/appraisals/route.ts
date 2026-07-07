import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLog } from "@/lib/audit/log";
import { loadHrStaffAppraisals } from "@/lib/hr/load";
import { requireStaffAppraisalAccess } from "@/lib/hr/require-appraisal-addon";
import { appraisalCreateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requireStaffAppraisalAccess();
  if (response) return response;

  const items = await loadHrStaffAppraisals(user.businessId);
  return NextResponse.json({ data: items }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireStaffAppraisalAccess();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = appraisalCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data: employee } = await supabase
    .from("hr_employees")
    .select("id")
    .eq("id", parsed.employee_id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json(
      { error: "employee_not_found", message: "Employee was not found." },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("hr_staff_appraisals")
    .insert({
      business_id: user.businessId,
      employee_id: parsed.employee_id,
      period_label: parsed.period_label,
      due_date: parsed.due_date,
      notes: parsed.notes ?? null,
    })
    .select(
      "id, employee_id, period_label, due_date, status, rating, notes, completed_at",
    )
    .single();

  if (error) {
    const duplicate = error.message.includes("unique");
    return NextResponse.json(
      {
        error: duplicate ? "duplicate_period" : "create_failed",
        message: duplicate
          ? "This employee already has an appraisal for that period."
          : "Could not schedule appraisal.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.appraisal.create",
    entityType: "hr_staff_appraisals",
    entityId: data.id,
    diff: {
      employee_id: parsed.employee_id,
      period_label: parsed.period_label,
      due_date: parsed.due_date,
    },
  });

  return NextResponse.json({ item: data }, { status: 201 });
}
