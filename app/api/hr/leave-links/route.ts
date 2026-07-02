import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  buildStaffLeaveUrl,
  expiresIn24Hours,
  hashLeaveLinkToken,
  makeLeaveLinkToken,
} from "@/lib/hr/leave-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createLinkSchema = z.object({
  employee_id: z.string().uuid(),
});

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

function requestOrigin(request: Request): string {
  return (
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin
  );
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
    parsed = createLinkSchema.parse(body);
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
  const { data: employee, error: employeeError } = await supabase
    .from("hr_employees")
    .select("id, full_name")
    .eq("id", parsed.employee_id)
    .eq("business_id", user.businessId)
    .single();

  if (employeeError || !employee) {
    return NextResponse.json(
      { error: "employee_not_found", message: "Employee was not found." },
      { status: 404 },
    );
  }

  const token = makeLeaveLinkToken();
  const expiresAt = expiresIn24Hours();
  const { data: link, error: linkError } = await supabase
    .from("hr_leave_request_links")
    .insert({
      business_id: user.businessId,
      employee_id: employee.id,
      token_hash: hashLeaveLinkToken(token),
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id, employee_id, expires_at")
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not create leave link." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      link,
      employee: { id: employee.id, full_name: employee.full_name },
      url: buildStaffLeaveUrl(requestOrigin(request), token),
    },
    { status: 201 },
  );
}
