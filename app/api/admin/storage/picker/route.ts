import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import {
  canUploadAdminStorageCategory,
  canUseAdminFilePicker,
  hasFullAdminStorageAccess,
} from "@/lib/admin/storage-cross-access";
import { ADMIN_FILE_CATEGORIES } from "@/lib/admin/schemas";
import type { AdminFileCategory } from "@/lib/admin/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseCategoryParam(raw: string | null): AdminFileCategory | null {
  if (!raw) return null;
  return (ADMIN_FILE_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as AdminFileCategory)
    : null;
}

/** GET /api/admin/storage/picker — minimal file list for cross-pillar attach UIs. */
export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Authentication required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canUseAdminFilePicker(user.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "forbidden", message: "You cannot access the file picker." },
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? "100") || 100),
  );
  const category = parseCategoryParam(url.searchParams.get("category"));
  const imagesOnly = url.searchParams.get("images_only") === "1";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("admin_files")
    .select("id, file_name, mime_type, category")
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (user.role === "hr_officer") {
    query = query.eq("category", "hr_doc");
  } else if (category) {
    query = query.eq("category", category);
  }

  if (imagesOnly) {
    query = query.like("mime_type", "image/%");
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "list_failed", message: error.message } },
      { status: 500 },
    );
  }

  const pickerCategory = user.role === "hr_officer" ? "hr_doc" : category;
  const canUpload = pickerCategory
    ? canUploadAdminStorageCategory(user.role, pickerCategory)
    : hasFullAdminStorageAccess(user.role);

  return NextResponse.json({
    ok: true,
    data: {
      files: data ?? [],
      can_upload: canUpload,
      category: pickerCategory,
    },
  });
}
