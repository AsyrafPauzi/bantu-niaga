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
  logComplianceRenewal,
} from "@/lib/admin/compliance-server";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminComplianceUpdateSchema,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    parsed = adminComplianceUpdateSchema.parse(body);
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

  const { data: existing, error: fetchErr } = await supabase
    .from("admin_compliance_items")
    .select("expires_on")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Licence not found." },
      },
      { status: 404 },
    );
  }

  const patch: Record<string, unknown> = {};

  if (parsed.title !== undefined) patch.title = parsed.title;
  if (parsed.category !== undefined) patch.category = parsed.category;
  if (parsed.authority !== undefined) patch.authority = parsed.authority;
  if (parsed.reference_number !== undefined) {
    patch.reference_number = parsed.reference_number;
  }
  if (parsed.notes !== undefined) patch.notes = parsed.notes;
  if (parsed.remind_days !== undefined) patch.remind_days = parsed.remind_days;
  if (parsed.admin_file_id !== undefined) {
    patch.admin_file_id = parsed.admin_file_id;
  }

  if (parsed.status === "renewed") {
    patch.status = "active";
    patch.last_renewed_at = new Date().toISOString();
    if (parsed.next_expires_on) {
      patch.expires_on = parsed.next_expires_on;
    }
  } else if (parsed.status !== undefined) {
    patch.status = parsed.status;
  } else if (parsed.expires_on !== undefined) {
    patch.expires_on = parsed.expires_on;
  }

  const { data, error } = await supabase
    .from("admin_compliance_items")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(COMPLIANCE_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "update_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  if (
    parsed.status === "renewed" &&
    parsed.next_expires_on &&
    parsed.next_expires_on !== existing.expires_on
  ) {
    try {
      await logComplianceRenewal(supabase, {
        businessId: user.businessId,
        complianceItemId: id,
        previousExpiresOn: String(existing.expires_on),
        newExpiresOn: parsed.next_expires_on,
        renewedBy: user.id,
        adminFileId:
          parsed.admin_file_id !== undefined
            ? parsed.admin_file_id
            : (data as { admin_file_id?: string | null }).admin_file_id ?? null,
      });
    } catch (logErr) {
      console.error("compliance renewal log failed", logErr);
    }
  }

  const [enriched] = await enrichComplianceRows(supabase, [
    data as unknown as AdminComplianceRow,
  ]);

  return NextResponse.json({ ok: true, data: enriched }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("admin_compliance_items")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "delete_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
