import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminComplianceRenewalEvent } from "@/lib/admin/task-compliance-schemas";

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
          { ok: false, error: { code: "forbidden", message: "Forbidden." } },
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
          { ok: false, error: { code: "unauthorized", message: "Auth required." } },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;

  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("admin_compliance_items")
    .select("id")
    .eq("id", id)
    .eq("business_id", auth.user!.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Licence not found." } },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("admin_compliance_renewal_events")
    .select(
      "id, compliance_item_id, previous_expires_on, new_expires_on, renewed_by, admin_file_id, created_at",
    )
    .eq("compliance_item_id", id)
    .eq("business_id", auth.user!.businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "list_failed" } },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as AdminComplianceRenewalEvent[];
  const fileIds = Array.from(
    new Set(rows.map((r) => r.admin_file_id).filter(Boolean)),
  ) as string[];

  const fileNames = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data: files } = await supabase
      .from("admin_files")
      .select("id, file_name")
      .in("id", fileIds)
      .is("deleted_at", null);
    for (const f of files ?? []) {
      fileNames.set(f.id as string, f.file_name as string);
    }
  }

  const enriched = rows.map((row) => ({
    ...row,
    admin_file_name: row.admin_file_id
      ? (fileNames.get(row.admin_file_id) ?? null)
      : null,
  }));

  return NextResponse.json({ ok: true, data: enriched });
}
