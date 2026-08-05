import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import {
  COMPLIANCE_SELECT,
  enrichComplianceRows,
} from "@/lib/admin/compliance-server";
import { DEFAULT_COMPLIANCE_REMIND_DAYS } from "@/lib/admin/compliance-shared";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminComplianceCreateSchema,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";
import { postBusinessNotification } from "@/lib/notifications/post";

export const dynamic = "force-dynamic";

async function requireComplianceUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "compliance")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access compliance tracking.",
            },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function GET(request: Request) {
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") !== "false";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("admin_compliance_items")
    .select(COMPLIANCE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("expires_on", { ascending: true });

  if (activeOnly) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  const rows = await enrichComplianceRows(
    supabase,
    (data ?? []) as unknown as AdminComplianceRow[],
  );
  return NextResponse.json({ ok: true, data: rows }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_json", message: "Invalid JSON body." },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = adminComplianceCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_compliance_items")
    .insert({
      business_id: user.businessId,
      title: parsed.title,
      category: parsed.category ?? "other",
      authority: parsed.authority ?? null,
      reference_number: parsed.reference_number ?? null,
      expires_on: parsed.expires_on,
      notes: parsed.notes ?? null,
      remind_days: parsed.remind_days ?? [...DEFAULT_COMPLIANCE_REMIND_DAYS],
      admin_file_id: parsed.admin_file_id ?? null,
      created_by: user.id,
    })
    .select(COMPLIANCE_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "create_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  const [enriched] = await enrichComplianceRows(supabase, [
    data as unknown as AdminComplianceRow,
  ]);

  void postBusinessNotification({
    businessId: user.businessId,
    eventType: "compliance.created",
    message: `Compliance item added: ${parsed.title}`,
    meta: { compliance_id: enriched?.id },
  });

  return NextResponse.json({ ok: true, data: enriched }, { status: 201 });
}
