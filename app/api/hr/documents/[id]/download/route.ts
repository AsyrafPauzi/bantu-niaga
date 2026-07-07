import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "admin-files";
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: doc, error } = await supabase
    .from("hr_employee_documents")
    .select(
      "id, admin_file_id, label, admin_files(storage_path, file_name, mime_type)",
    )
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const storagePath = (
    doc?.admin_files as { storage_path?: string } | null
  )?.storage_path;

  if (!doc?.admin_file_id || !storagePath) {
    return NextResponse.json(
      { error: "not_found", message: "No file linked to this document." },
      { status: 404 },
    );
  }

  const admin = createServiceRoleClient();
  const { data: signed, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
