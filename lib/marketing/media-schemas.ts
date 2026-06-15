import { z } from "zod";

/**
 * Zod schemas + helpers for the Marketing media routes.
 *
 * Sibling of `lib/admin/schemas.ts` but scoped to the marketing-media
 * surface (Content > New Post photo / video / carousel / upload). The
 * shapes are intentionally similar so the front-end mental model is one
 * uploader pattern reused across pillars.
 */

/**
 * Hard cap on uploaded file size — 100 MB.
 *
 * Enforced in three places (defence-in-depth):
 *   1. Client-side guard in `ContentMediaUploader`.
 *   2. Server-side validators below (rejected with HTTP 413).
 *   3. Postgres CHECK constraint on `marketing_files.file_size_bytes` in
 *      `supabase/migrations/00000000000021_marketing_media.sql`.
 */
export const MARKETING_FILE_MAX_BYTES = 100 * 1024 * 1024; // 104_857_600

export const MARKETING_FILE_MAX_NAME_LEN = 255;

/**
 * Allowed MIME-type prefixes for marketing media. Photos + videos only.
 * The client surfaces this through the four picker buttons; the server
 * enforces it on every prepare-upload and confirm call so a malicious
 * client can't sneak in arbitrary file types.
 */
export const MARKETING_FILE_MIME_PREFIXES = ["image/", "video/"] as const;

/** True iff `mime` is one of the allowed marketing prefixes. */
export function isMarketingMimeAllowed(mime: string): boolean {
  const trimmed = mime.trim().toLowerCase();
  return MARKETING_FILE_MIME_PREFIXES.some((p) => trimmed.startsWith(p));
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/media/prepare-upload — issue signed upload URL
// ─────────────────────────────────────────────────────────────────────────

export const marketingFilePrepareUploadSchema = z
  .object({
    file_name: z
      .string()
      .trim()
      .min(1, "File name is required.")
      .max(MARKETING_FILE_MAX_NAME_LEN),
    mime_type: z.string().trim().min(1).max(255),
    file_size_bytes: z
      .number()
      .int("File size must be a whole number of bytes.")
      .positive("File size must be greater than 0.")
      .max(
        MARKETING_FILE_MAX_BYTES,
        "File too large. Maximum upload size is 100 MB.",
      ),
  })
  .strict();

export type MarketingFilePrepareUpload = z.infer<
  typeof marketingFilePrepareUploadSchema
>;

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/media/confirm — record metadata after PUT
// ─────────────────────────────────────────────────────────────────────────

export const marketingFileConfirmSchema = z
  .object({
    storage_path: z.string().trim().min(1).max(1024),
    file_name: z.string().trim().min(1).max(MARKETING_FILE_MAX_NAME_LEN),
    mime_type: z.string().trim().min(1).max(255),
    file_size_bytes: z
      .number()
      .int()
      .positive()
      .max(
        MARKETING_FILE_MAX_BYTES,
        "File too large. Maximum upload size is 100 MB.",
      ),
  })
  .strict();

export type MarketingFileConfirm = z.infer<typeof marketingFileConfirmSchema>;

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/media/attach-to-content
// ─────────────────────────────────────────────────────────────────────────

export const marketingMediaAttachSchema = z
  .object({
    content_plan_id: z.string().uuid(),
    file_ids: z.array(z.string().uuid()).min(1).max(10),
    /** Where to start numbering positions in content_plan_media. */
    position_start: z.coerce.number().int().min(0).max(99).optional().default(0),
  })
  .strict();

export type MarketingMediaAttach = z.infer<typeof marketingMediaAttachSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Wire types — list rows + responses
// ─────────────────────────────────────────────────────────────────────────

export interface MarketingFileRow {
  id: string;
  business_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingFilePrepareUploadResponse {
  upload_url: string;
  storage_path: string;
  expires_at: string;
  /**
   * Echoed back from Supabase Storage's signed-upload SDK. Some SDK
   * builds expect the signed-token PUT to use the URL exactly as
   * returned; others split the token into a separate field. We surface
   * both so the client can branch defensively (matches the admin
   * uploader contract).
   */
  token?: string;
  /** Client-only correlation id used to label the row in the UI. */
  temp_id: string;
}

export interface MarketingFileDownloadResponse {
  download_url: string;
  expires_at: string;
  file_name: string;
  mime_type: string;
}

// ─────────────────────────────────────────────────────────────────────────
// File-name sanitiser
//
// Same shape as sanitiseAdminFileName — kept independent to avoid
// cross-pillar coupling on a `lib/admin/*` import from marketing code.
// ─────────────────────────────────────────────────────────────────────────

export function sanitiseMarketingFileName(input: string): string {
  const stripped = input
    .replace(/[\\/]+/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  const truncated = stripped.slice(0, MARKETING_FILE_MAX_NAME_LEN);
  return truncated.length > 0 ? truncated : "file";
}
