import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";
import { leaveCreateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireHrUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const leave = await loadHrLeaveRecords(user.businessId);
  return NextResponse.json({ data: leave }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = leaveCreateSchema.parse(body);
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
  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...parsed,
      business_id: user.businessId,
      requested_by: user.id,
    })
    .select(
      "id, employee_id, leave_type, start_date, end_date, reason, status, decision_note, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not create leave record." },
      { status: 500 },
    );
  }

  return NextResponse.json({ leave: data }, { status: 201 });
}
