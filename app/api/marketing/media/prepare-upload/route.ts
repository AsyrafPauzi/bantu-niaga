import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";
import {
  MARKETING_FILE_MAX_BYTES,
  isMarketingMimeAllowed,
  marketingFilePrepareUploadSchema,
  sanitiseMarketingFileName,
  type MarketingFilePrepareUploadResponse,
} from "@/lib/marketing/media-schemas";

/**
 * POST /api/marketing/media/prepare-upload — issue a signed upload URL
 * (5 min) for one marketing media file. The client PUTs the bytes
 * directly to Supabase Storage so the Next.js server never sees the
 * 100 MB body.
 *
 * Auth: getCurrentUser() → 401 if no session.
 * RBAC: canSurface(role, 'marketing', 'content') → 403 if false. In the
 *       current matrix that's owner + manager only.
 *
 * The response includes a `temp_id` the client uses purely for thumbnail
 * row correlation; nothing on the server reads it.
 */

export const dynamic = "force-dynamic";

const log = logger.child({ module: "marketing.media.prepare" });
const STORAGE_BUCKET = "marketing-media";
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

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
              message: "You don't have permission to upload marketing media.",
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

export async function POST(request: Request) {
  const auth = await requireMediaUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "bad_request", message: "Request body must be valid JSON." },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = marketingFilePrepareUploadSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const sizeIssue = e.issues.find(
        (issue) =>
          issue.path.length === 1 &&
          issue.path[0] === "file_size_bytes" &&
          (issue.code === "too_big" || issue.code === "too_small"),
      );
      if (sizeIssue) {
        const tooLarge =
          sizeIssue.code === "too_big" ||
          (sizeIssue as { maximum?: number }).maximum != null;
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: tooLarge ? "file_too_large" : "file_too_small",
              message: tooLarge
                ? "File too large. Maximum upload size is 100 MB."
                : "File size must be greater than 0.",
            },
          },
          { status: tooLarge ? 413 : 400 },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "validation_failed",
            message: "Validation failed.",
            details: e.issues,
          },
        },
        { status: 422 },
      );
    }
    throw e;
  }

  // Defence-in-depth size cap (Zod already enforces it).
  if (parsed.file_size_bytes > MARKETING_FILE_MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "file_too_large",
          message: "File too large. Maximum upload size is 100 MB.",
        },
      },
      { status: 413 },
    );
  }
  if (parsed.file_size_bytes <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "file_too_small",
          message: "File size must be greater than 0.",
        },
      },
      { status: 400 },
    );
  }

  if (!isMarketingMimeAllowed(parsed.mime_type)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "unsupported_media_type",
          message: "Only image/* and video/* files are allowed.",
        },
      },
      { status: 415 },
    );
  }

  const sanitisedName = sanitiseMarketingFileName(parsed.file_name);
  // <business_id>/<random>/<sanitised_name> — the bucket RLS pins the
  // first segment to the caller's business and the random UUID stops
  // two users colliding on the same filename.
  const storagePath = `${user.businessId}/${randomUUID()}/${sanitisedName}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    log.error("signed_upload_url_failed", { storagePath }, error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "storage_signed_url_failed",
          message: "Could not prepare the upload. Please try again.",
        },
      },
      { status: 500 },
    );
  }

  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();
  const responseBody: MarketingFilePrepareUploadResponse = {
    upload_url: data.signedUrl,
    storage_path: storagePath,
    token: data.token,
    expires_at: expiresAt,
    temp_id: randomUUID(),
  };

  return NextResponse.json({ ok: true, data: responseBody }, { status: 200 });
}
