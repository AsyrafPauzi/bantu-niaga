import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { hashLeaveLinkToken, isLeaveLinkUsable } from "@/lib/hr/leave-links";
import { publicLeaveCreateSchema } from "@/lib/hr/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

interface LeaveLinkRow {
  id: string;
  business_id: string;
  employee_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

async function loadLink(token: string): Promise<LeaveLinkRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("hr_leave_request_links")
    .select("id, business_id, employee_id, expires_at, used_at, revoked_at")
    .eq("token_hash", hashLeaveLinkToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(`leave link lookup failed: ${error.message}`);
  }
  return data as LeaveLinkRow | null;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const link = await loadLink(token);
  if (!link || !isLeaveLinkUsable(link)) {
    return NextResponse.json(
      {
        error: "link_unavailable",
        message: "This leave link has expired. Please request a new link from your manager.",
      },
      { status: 410 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = publicLeaveCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = createServiceRoleClient();
  const usedAt = new Date().toISOString();
  const { data: usedLink, error: useError } = await supabase
    .from("hr_leave_request_links")
    .update({ used_at: usedAt })
    .eq("id", link.id)
    .select("id")
    .single();

  if (useError || !usedLink) {
    return NextResponse.json(
      { error: "link_use_failed", message: "Could not use this leave link." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...parsed,
      business_id: link.business_id,
      employee_id: link.employee_id,
      status: "pending",
      requested_by: null,
    })
    .select("id, employee_id, leave_type, start_date, end_date, reason, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not submit leave request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ leave: data }, { status: 201 });
}
