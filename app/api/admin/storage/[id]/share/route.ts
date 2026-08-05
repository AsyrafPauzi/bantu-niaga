import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canShareAdminFileCategory, adminFileShareUrl } from "@/lib/admin/share";
import { newAdminFileShareHash } from "@/lib/admin/share-server";
import { canSurface } from "@/lib/permissions";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireStorageUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "storage")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to share storage files.",
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

/**
 * POST   /api/admin/storage/[id]/share — enable or rotate public share link
 * DELETE /api/admin/storage/[id]/share — revoke public access
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireStorageUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data: row, error: lookupErr } = await supabase
    .from("admin_files")
    .select("id, category, share_hash")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr || !row) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "File not found." },
      },
      { status: 404 },
    );
  }

  if (!canShareAdminFileCategory(row.category)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "share_not_allowed",
          message: "HR documents cannot be shared via a public link.",
        },
      },
      { status: 403 },
    );
  }

  const shareHash = newAdminFileShareHash();
  const { error: updateErr } = await supabase
    .from("admin_files")
    .update({
      share_hash: shareHash,
      share_enabled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (updateErr) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "update_failed", message: updateErr.message },
      },
      { status: 500 },
    );
  }

  const business = await loadBusiness(user.businessId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const shareUrl =
    business?.idcompany != null
      ? adminFileShareUrl(appUrl, business.idcompany, shareHash)
      : null;

  return NextResponse.json({
    ok: true,
    data: {
      share_hash: shareHash,
      share_url: shareUrl,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireStorageUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("admin_files")
    .update({ share_enabled_at: null })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "update_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
