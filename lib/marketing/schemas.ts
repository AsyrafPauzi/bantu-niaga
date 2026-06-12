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
// Re-exports
// ─────────────────────────────────────────────────────────────────────────

export const customerSources = CUSTOMER_SOURCES;
export const autoTagValues = AUTO_TAGS;
