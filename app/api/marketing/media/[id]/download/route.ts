import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";
import type { MarketingFileDownloadResponse } from "@/lib/marketing/media-schemas";

/**
 * GET /api/marketing/media/[id]/download — issue a short-lived signed
 * download URL for the file's bytes (60s — used by the in-app preview;
 * the client typically embeds it in an <img>/<video> tag).
 *
 *   - 401 if no session
 *   - 403 if role can't access Marketing content
 *   - 404 if the row is in another business / soft-deleted
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "marketing.media.download" });
const STORAGE_BUCKET = "marketing-media";
const DOWNLOAD_URL_TTL_SECONDS = 60;

interface AuthResult {
  user: CurrentUser | null;
  response: NextResponse | null;
}

async function requireMediaUser(): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to download marketing media.",
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await requireMediaUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const supabase = await createSupabaseServerClient();
  const { data: row, error: lookupErr } = await supabase
    .from("marketing_files")
    .select("id, storage_path, file_name, mime_type, deleted_at, business_id")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr) {
    log.error("lookup_failed", { id, businessId: user.businessId }, lookupErr);
    return NextResponse.json(
      {
        ok: false,
        error: { code: "lookup_failed", message: "Could not load the file." },
      },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "File not found." },
      },
      { status: 404 },
    );
  }

  const fileRow = row as unknown as {
    storage_path: string;
    file_name: string;
    mime_type: string;
  };

  const admin = createServiceRoleClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(fileRow.storage_path, DOWNLOAD_URL_TTL_SECONDS);

  if (signErr || !signed) {
    log.error(
      "sign_failed",
      { id, storagePath: fileRow.storage_path },
      signErr,
    );
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "signed_url_failed",
          message: "Could not prepare the download link.",
        },
      },
      { status: 500 },
    );
  }

  const body: MarketingFileDownloadResponse = {
    download_url: signed.signedUrl,
    expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    file_name: fileRow.file_name,
    mime_type: fileRow.mime_type,
  };

  return NextResponse.json({ ok: true, data: body }, { status: 200 });
}
