import { z } from "zod";

/**
 * Zod schemas for the Admin Digital Storage routes.
 *
 * Request bodies are validated through these schemas; route handlers
 * import the inferred types via `z.infer` so the wire contract has a
 * single source of truth.
 */

/**
 * Hard cap on uploaded file size — 100 MB.
 *
 * Enforced in three places (defence-in-depth):
 *   1. Client-side guard in `AdminFileUploader` (`MAX_UPLOAD_BYTES`).
 *   2. Server-side validators below (rejected with HTTP 413).
 *   3. Postgres CHECK constraint on `admin_files.file_size_bytes` in
 *      `supabase/migrations/00000000000019_admin_storage.sql`.
 */
export const ADMIN_FILE_MAX_BYTES = 100 * 1024 * 1024; // 104_857_600

export const ADMIN_FILE_MAX_NAME_LEN = 255;

/**
 * Categories accepted on uploads. Free-form `null` is also fine; HR
 * Officer is server-side forced to `'hr_doc'` by the upload route.
 */
export const ADMIN_FILE_CATEGORIES = [
  "receipt",
  "contract",
  "hr_doc",
  "compliance",
  "finance",
  "operations",
  "other",
] as const;
export type AdminFileCategory = (typeof ADMIN_FILE_CATEGORIES)[number];

// ─────────────────────────────────────────────────────────────────────────
// POST /api/admin/storage — issue signed upload URL
// ─────────────────────────────────────────────────────────────────────────

export const adminFileUploadInitSchema = z
  .object({
    file_name: z
      .string()
      .trim()
      .min(1, "File name is required.")
      .max(ADMIN_FILE_MAX_NAME_LEN),
    mime_type: z.string().trim().min(1).max(255),
    file_size_bytes: z
      .number()
      .int("File size must be a whole number of bytes.")
      .positive("File size must be greater than 0.")
      .max(
        ADMIN_FILE_MAX_BYTES,
        "File too large. Maximum upload size is 100 MB.",
      ),
    category: z
      .enum(ADMIN_FILE_CATEGORIES)
      .optional()
      .nullable(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable(),
  })
  .strict();

export type AdminFileUploadInit = z.infer<typeof adminFileUploadInitSchema>;

// ─────────────────────────────────────────────────────────────────────────
// POST /api/admin/storage/confirm — record metadata after PUT
// ─────────────────────────────────────────────────────────────────────────

export const adminFileConfirmSchema = z
  .object({
    storage_path: z.string().trim().min(1).max(1024),
    file_name: z
      .string()
      .trim()
      .min(1)
      .max(ADMIN_FILE_MAX_NAME_LEN),
    mime_type: z.string().trim().min(1).max(255),
    file_size_bytes: z
      .number()
      .int()
      .positive()
      .max(
        ADMIN_FILE_MAX_BYTES,
        "File too large. Maximum upload size is 100 MB.",
      ),
    category: z
      .enum(ADMIN_FILE_CATEGORIES)
      .optional()
      .nullable(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable(),
  })
  .strict();

export type AdminFileConfirm = z.infer<typeof adminFileConfirmSchema>;

// ─────────────────────────────────────────────────────────────────────────
// GET /api/admin/storage — list query
// ─────────────────────────────────────────────────────────────────────────

export const adminFileListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.enum(ADMIN_FILE_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /**
   * Opaque cursor: `<iso-created_at>__<id>`. The handler decodes it for
   * the keyset paging `(created_at, id) < (cursor.created_at, cursor.id)`
   * clause; the client treats it as a black box.
   */
  cursor: z.string().trim().min(1).max(200).optional(),
});

export type AdminFileListQuery = z.infer<typeof adminFileListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────
// Wire types — list rows + responses
// ─────────────────────────────────────────────────────────────────────────

export interface AdminFileRow {
  id: string;
  business_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by_name: string | null;
}

export interface AdminFileUploadInitResponse {
  upload_url: string;
  storage_path: string;
  expires_at: string;
  /**
   * Some Supabase Storage SDK builds expect the signed-token PUT to use
   * the URL exactly as returned; others split the token into a separate
   * field. We surface both so the client can branch defensively.
   */
  token?: string;
}

export interface AdminFileDownloadResponse {
  download_url: string;
  expires_at: string;
  file_name: string;
  mime_type: string;
}

export interface AdminFileListResponse {
  data: AdminFileRow[];
  next_cursor: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// File-name sanitiser
// ─────────────────────────────────────────────────────────────────────────

/**
 * Strip path separators + control chars and truncate to the column cap.
 * The result is used both as the stored `file_name` (shown to users) and
 * as the last segment of `storage_path` (so it must round-trip cleanly
 * inside a URL — the random UUID directory in front of it makes the full
 * path unique even if the sanitised name collides).
 *
 * Examples:
 *   "../../etc/passwd"            → "etcpasswd"
 *   "Q3 Report\u0000.pdf"         → "Q3 Report.pdf"
 *   "  weird   .docx  "           → "weird   .docx"
 *   ""                             → "file"
 */
export function sanitiseAdminFileName(input: string): string {
  const stripped = input
    // path separators (handles macOS / Linux / Windows)
    .replace(/[\\/]+/g, "")
    // ASCII control chars (NUL + C0)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  const truncated = stripped.slice(0, ADMIN_FILE_MAX_NAME_LEN);
  return truncated.length > 0 ? truncated : "file";
}
