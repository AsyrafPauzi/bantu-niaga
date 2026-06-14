import { z } from "zod";

/**
 * Zod schemas for Marketing API routes.
 *
 * Re-exported into route handlers. Mirrors the field shapes in
 * `docs/plans/marketing-implementation-plan.md` §4.2 and the M2
 * additions in `docs/plans/marketing-decisions.md` Q5, Q8, Q10, Q11.
 */

const CUSTOMER_SOURCES = [
  "pos",
  "booking",
  "lead_conversion",
  "csv_import",
  "manual",
  "public_booking_page",
] as const;

const AUTO_TAGS = ["new", "repeat", "vip", "dormant", "at-risk"] as const;

const LIST_SORT_FIELDS = ["name", "last_purchase_at", "total_spend_myr"] as const;
const LIST_SORT_ORDERS = ["asc", "desc"] as const;

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/customers
// ─────────────────────────────────────────────────────────────────────────

export const CustomerCreateInput = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().max(500).optional(),
  manual_tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .optional()
    .default([]),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(CUSTOMER_SOURCES).default("manual"),
  /**
   * When the dedup pipeline returns `prompt` the calling UI can either
   * abandon the create or re-POST with `force_create: true` to insert
   * the row anyway (the operator confirmed "Keep separate" from the
   * `<MergePromptBanner>` UI).
   */
  force_create: z.boolean().optional().default(false),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateInput>;

// ─────────────────────────────────────────────────────────────────────────
// GET /api/marketing/customers — list
// ─────────────────────────────────────────────────────────────────────────

const csvList = z
  .string()
  .trim()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0),
  )
  .pipe(z.array(z.string().min(1).max(40)).max(20));

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD or ISO 8601"));

export const ListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  tags: csvList.optional(),
  source: z.enum(CUSTOMER_SOURCES).optional(),
  last_purchase_before: isoDate.optional(),
  last_purchase_after: isoDate.optional(),
  min_spend: z.coerce.number().nonnegative().optional(),
  max_spend: z.coerce.number().nonnegative().optional(),
  sort: z.enum(LIST_SORT_FIELDS).default("last_purchase_at"),
  order: z.enum(LIST_SORT_ORDERS).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListQuery = z.infer<typeof ListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/marketing/customers/[id]
//
// Two variants:
//   - patchCustomerFullSchema       — desktop: every editable field
//   - patchCustomerRestrictedSchema — mobile (per Q10): notes, manual_tags,
//                                     phone only
// ─────────────────────────────────────────────────────────────────────────

const optionalStr = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const patchCustomerFullSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
    address: optionalStr(500),
    manual_tags: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .optional(),
    notes: optionalStr(2000),
  })
  .strict();

export type PatchCustomerFull = z.infer<typeof patchCustomerFullSchema>;

export const patchCustomerRestrictedSchema = z
  .object({
    phone: z.string().trim().nullable().optional(),
    manual_tags: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .optional(),
    notes: optionalStr(2000),
  })
  .strict();

export type PatchCustomerRestricted = z.infer<typeof patchCustomerRestrictedSchema>;

/**
 * Return the right PATCH schema for the requesting surface.
 *
 * @see docs/plans/marketing-decisions.md Q10 — mobile is restricted to
 * `notes`, `manual_tags`, `phone`.
 */
export type SurfaceMode = "desktop" | "mobile";

export function patchSchemaForMode(mode: SurfaceMode) {
  return mode === "mobile"
    ? patchCustomerRestrictedSchema
    : patchCustomerFullSchema;
}

// ─────────────────────────────────────────────────────────────────────────
// POST /api/marketing/customers/[id]/merge
// ─────────────────────────────────────────────────────────────────────────

export const mergeBodySchema = z
  .object({
    winner_id: z.string().uuid(),
    loser_id: z.string().uuid(),
  })
  .refine((v) => v.winner_id !== v.loser_id, {
    message: "winner_id and loser_id must differ",
    path: ["loser_id"],
  });

export type MergeBody = z.infer<typeof mergeBodySchema>;

// ─────────────────────────────────────────────────────────────────────────
// GET /api/marketing/customers/search — typeahead
// ─────────────────────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────
// CSV import / export — Marketing M3
//
// The upload endpoint is multipart/form-data, so Zod isn't used for the
// body itself; instead we expose a response schema and the import_id
// path-param shape, plus the commit + export query schemas.
// ─────────────────────────────────────────────────────────────────────────

/** Server-side max file size (bytes). Plan §8.6. */
export const CSV_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Server-side max parsed rows (decisions doc Q7). */
export const CSV_MAX_ROWS = 5000;
/** Preview cache TTL — used both at write (DB default) and read time. */
export const CSV_PREVIEW_TTL_HOURS = 24;

export const csvUploadResponseSchema = z.object({
  import_id: z.string().uuid(),
  file_size_bytes: z.number().int().nonnegative(),
  uploaded_at: z.string().datetime(),
});

export type CsvUploadResponse = z.infer<typeof csvUploadResponseSchema>;

/** Path-param shape for /csv-import/[id]/preview and /commit. */
export const csvImportIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Commit body — only carries the import_id (which is also in the URL path
 * for safety; commit handlers MUST verify they match before trusting
 * either). No row payload: the commit endpoint reads from the cached
 * preview on the import row so the operator can't slip in tampered rows
 * after preview.
 */
export const csvCommitBodySchema = z
  .object({
    import_id: z.string().uuid(),
  })
  .strict();

export type CsvCommitBody = z.infer<typeof csvCommitBodySchema>;

/**
 * Export query schema. v1 streams the full customer book; the only
 * parameter is the optional `tag` filter for "export only my VIPs" use
 * cases. Default = all live customers (no merged, no soft-deleted).
 */
export const csvExportQuerySchema = z.object({
  tag: z.string().trim().min(1).max(40).optional(),
});

export type CsvExportQuery = z.infer<typeof csvExportQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────
// Content calendar — Marketing M5
//
// Mirrors `docs/plans/marketing-implementation-plan.md` §4.2.7 and the
// existing `content_plan` table columns (channel / status / scheduled_at
// / hook / caption). The DB column is `channel`, not `platform` — we
// keep the API/UI vocabulary aligned with the schema.
//
// v1 is plan-only. Media attachments store the `file_id` (a uuid) into
// `content_plan_media` without an FK constraint; the FK lands once
// Admin Storage publishes its canonical `files` table (D6 contract).
// The placeholder thumbnails on the UI side render the uuid as a label
// so operators can audit the link manually until D6 is wired.
// ─────────────────────────────────────────────────────────────────────────

export const CONTENT_CHANNELS = ["tiktok", "instagram", "facebook"] as const;
export type ContentChannel = (typeof CONTENT_CHANNELS)[number];

export const CONTENT_STATUSES = [
  "idea",
  "drafted",
  "scheduled",
  "posted",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const contentChannelSchema = z.enum(CONTENT_CHANNELS);
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

/**
 * Hashtag input — accepts either `#tag` or bare `tag`. Normalised at
 * write time to always carry the leading `#` so the DB constraint
 * (`content_hashtags_ok`) is satisfied. Spaces are rejected.
 */
const hashtagItem = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((s) => !/\s/.test(s), "hashtags cannot contain whitespace")
  .transform((s) => (s.startsWith("#") ? s : `#${s}`));

const hashtagsArray = z.array(hashtagItem).max(30).optional().default([]);

/** Engagement counters (nullable on input, treated as 0 when absent). */
const engagementCount = z.coerce.number().int().min(0).max(1_000_000_000);

export const contentEntryCreateSchema = z
  .object({
    channel: contentChannelSchema,
    status: contentStatusSchema.optional().default("idea"),
    scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
    hook: z.string().trim().max(280).nullable().optional(),
    caption: z.string().trim().max(4000).nullable().optional(),
    hashtags: hashtagsArray,
    forecast_reach_min: z.coerce
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
    forecast_reach_max: z.coerce
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
    media_file_ids: z
      .array(z.string().uuid())
      .max(10)
      .optional()
      .default([]),
  })
  .strict();

export type ContentEntryCreateInput = z.infer<typeof contentEntryCreateSchema>;

export const contentEntryUpdateSchema = z
  .object({
    channel: contentChannelSchema.optional(),
    status: contentStatusSchema.optional(),
    scheduled_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    hook: z.string().trim().max(280).nullable().optional(),
    caption: z.string().trim().max(4000).nullable().optional(),
    hashtags: hashtagsArray.optional(),
    views: engagementCount.optional(),
    likes: engagementCount.optional(),
    comments_count: engagementCount.optional(),
    shares: engagementCount.optional(),
    saves: engagementCount.optional(),
    forecast_reach_min: z.coerce
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
    forecast_reach_max: z.coerce
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
  })
  .strict();

export type ContentEntryUpdateInput = z.infer<typeof contentEntryUpdateSchema>;

/** Empty body — POST /api/marketing/content/[id]/duplicate */
export const contentDuplicateSchema = z.object({}).strict();

/**
 * Calendar / list query. Two mutually-supportive shapes:
 *   - `?year=YYYY&month=1..12` → returns the entries whose `scheduled_at`
 *     (or `created_at` for unscheduled rows) falls in that month, in
 *     Asia/Kuala_Lumpur. The server still queries by UTC bounds and lets
 *     the UI do the local-time formatting.
 *   - `?status=…` and / or `?channel=…` → returns ALL matching entries
 *     across time, sorted by `scheduled_at` (nulls last) then `created_at`.
 *   - no params → all upcoming (scheduled_at ≥ today) + all unscheduled
 *     idea / drafted entries.
 */
export const contentListQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(3000).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    channel: contentChannelSchema.optional(),
    status: contentStatusSchema.optional(),
  })
  .refine(
    (v) =>
      (v.year === undefined && v.month === undefined) ||
      (v.year !== undefined && v.month !== undefined),
    {
      message: "year and month must be supplied together",
      path: ["month"],
    },
  );

export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

/**
 * Body for `POST /api/marketing/content/[id]/media`. v1 just records the
 * uuid; Admin Storage's `files` table FK lands in a follow-up migration
 * once D6 ships.
 */
export const contentMediaAttachSchema = z
  .object({
    file_id: z.string().uuid(),
    position: z.coerce.number().int().min(0).max(99).optional().default(0),
  })
  .strict();

export type ContentMediaAttachInput = z.infer<typeof contentMediaAttachSchema>;

/**
 * Server-side guard for the `status` lifecycle:
 *   idea → drafted → scheduled → posted   (forward path)
 *   any of {idea, drafted, scheduled} → any of {idea, drafted, scheduled}
 *   posted → (terminal — cannot be unposted in v1)
 */
export function isValidContentStatusTransition(
  current: ContentStatus,
  next: ContentStatus,
): boolean {
  if (current === next) return true;
  if (current === "posted") return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────

export const customerSources = CUSTOMER_SOURCES;
export const autoTagValues = AUTO_TAGS;
