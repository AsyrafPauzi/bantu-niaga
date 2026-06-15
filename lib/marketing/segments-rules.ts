/**
 * Bantu Niaga — Marketing v1.1 segment rule resolver.
 *
 * Pure helpers that compile the `rules` JSON shape (spec §3) into:
 *   1. A SQL WHERE clause + parameter map (`compileRulesToSql`) — the
 *      authoritative resolver, used in unit tests and for documentation.
 *   2. A supabase-js query-builder mutator (`applyRulesToCustomersQuery`)
 *      that wires those same rules into a tenant-scoped customers query
 *      so the API routes can let RLS run on the caller's session.
 *
 * Why both? The spec calls for a SQL-shaped resolver. Postgrest's filter
 * builder doesn't expose raw SQL, so the routes use the supabase-js
 * helper. The SQL view is kept in lockstep for testability.
 *
 * Rules shape (spec §3 — every key optional, empty rules matches all):
 *
 *   {
 *     "tags_any":         ["facebook_lead", "homestay_guest"],
 *     "min_spend_myr":    500,
 *     "max_spend_myr":    null,
 *     "inactive_days":    90,
 *     "sources":          ["facebook_lead", "manual"],
 *     "manual_tags_any":  ["wholesale"],
 *     "auto_tags_any":    ["vip", "at_risk"]
 *   }
 *
 * Auto-key normalisation: the customers.auto_tags array stores `at-risk`
 * (hyphen) for historical reasons (see lib/marketing/auto-tags.ts), while
 * spec §3 uses `at_risk` (underscore). The resolver maps between the two
 * so the rules JSON stays consistent with the spec.
 */
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// Auto-key vocabulary + customers.auto_tags mapping
// ─────────────────────────────────────────────────────────────────────────

export const AUTO_SEGMENT_KEYS = [
  "vip",
  "repeat",
  "new",
  "at_risk",
  "dormant",
] as const;
export type AutoSegmentKey = (typeof AUTO_SEGMENT_KEYS)[number];

export const AUTO_KEY_LABEL: Record<AutoSegmentKey, string> = {
  vip: "VIP",
  repeat: "Repeat",
  new: "New",
  at_risk: "At-risk",
  dormant: "Dormant",
};

/**
 * Map the spec's auto_key vocabulary onto the value that actually lives
 * in customers.auto_tags. Only at_risk differs (`at-risk`); the others
 * are identity.
 */
export function autoKeyToCustomerTag(key: AutoSegmentKey): string {
  return key === "at_risk" ? "at-risk" : key;
}

// ─────────────────────────────────────────────────────────────────────────
// Zod schema — every key optional, additional keys rejected.
// ─────────────────────────────────────────────────────────────────────────

const customerSources = [
  "pos",
  "booking",
  "lead_conversion",
  "csv_import",
  "manual",
  "public_booking_page",
] as const;

const tagString = z.string().trim().min(1).max(40);

export const SegmentRulesSchema = z
  .object({
    tags_any: z.array(tagString).max(20).optional(),
    min_spend_myr: z.number().finite().optional(),
    max_spend_myr: z.number().finite().optional(),
    inactive_days: z.number().int().optional(),
    sources: z.array(z.enum(customerSources)).max(6).optional(),
    manual_tags_any: z.array(tagString).max(20).optional(),
    auto_tags_any: z.array(z.enum(AUTO_SEGMENT_KEYS)).max(5).optional(),
  })
  .strict();

export type SegmentRules = z.infer<typeof SegmentRulesSchema>;

export function isSegmentRules(value: unknown): value is SegmentRules {
  return SegmentRulesSchema.safeParse(value).success;
}

/**
 * Quickly check whether a rules object would match every active
 * customer (no real filter present). An empty / undefined-everywhere
 * rules JSON is the "{} matches every active customer" case from spec §3.
 */
export function isEmptyRules(rules: SegmentRules): boolean {
  return (
    !rules.tags_any?.length &&
    rules.min_spend_myr === undefined &&
    rules.max_spend_myr === undefined &&
    rules.inactive_days === undefined &&
    !rules.sources?.length &&
    !rules.manual_tags_any?.length &&
    !rules.auto_tags_any?.length
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Auto segment → synthetic rules
//
// An auto segment with auto_key=K behaves as if it had rules
// {auto_tags_any: [K]}. The resolver uses the same code path for both.
// ─────────────────────────────────────────────────────────────────────────

export function autoSegmentRules(key: AutoSegmentKey): SegmentRules {
  return { auto_tags_any: [key] };
}

// ─────────────────────────────────────────────────────────────────────────
// SQL compiler — the authoritative shape. Returns parameter-bound clauses.
// ─────────────────────────────────────────────────────────────────────────

export interface CompiledRules {
  /** Joined with AND. Parameter placeholders use `:name` syntax. */
  whereClause: string;
  /** Map of bound values, keyed by placeholder name (no leading colon). */
  params: Record<string, unknown>;
}

/**
 * Compile a rules JSON into a parameterized SQL WHERE clause against
 * `public.customers`. The returned clause always:
 *
 *   - tenant-scopes via `business_id = :business_id`
 *   - excludes `deleted_at IS NOT NULL` rows
 *   - excludes `merged_into_id IS NOT NULL` rows
 *
 * Caller is responsible for the surrounding SELECT and the
 * substitution of parameters into the bound query (PostgREST does this
 * via `.eq()/.in()/.gte()` calls — see `applyRulesToCustomersQuery`).
 *
 * Pure function. Same input → same output. Used by the resolver unit
 * tests as the contract surface.
 */
export function compileRulesToSql(
  rules: SegmentRules,
  businessId: string,
): CompiledRules {
  const conditions: string[] = [
    "business_id = :business_id",
    "deleted_at IS NULL",
    "merged_into_id IS NULL",
  ];
  const params: Record<string, unknown> = { business_id: businessId };

  // tags_any + manual_tags_any + auto_tags_any all use the gin-indexed
  // `&&` (array-overlap) operator. We OR tags_any with manual_tags_any
  // (both target the same conceptual "string tags I gave the customer"
  // surface) and AND that group with auto_tags_any (these are
  // system-computed and conceptually a different axis).
  const stringTags = new Set<string>();
  for (const t of rules.tags_any ?? []) stringTags.add(t);
  for (const t of rules.manual_tags_any ?? []) stringTags.add(t);
  if (stringTags.size > 0) {
    const tagArray = Array.from(stringTags);
    params.string_tags = tagArray;
    // Match either manual_tags or auto_tags arrays — operators tend to
    // mix the two when typing the chip-input. PostgREST's `.or()` does
    // the same OR-across-columns inside a single condition.
    conditions.push(
      "(manual_tags && :string_tags::text[] OR auto_tags && :string_tags::text[])",
    );
  }

  if (rules.auto_tags_any && rules.auto_tags_any.length > 0) {
    const mapped = rules.auto_tags_any.map(autoKeyToCustomerTag);
    params.auto_tags = mapped;
    conditions.push("auto_tags && :auto_tags::text[]");
  }

  if (typeof rules.min_spend_myr === "number") {
    params.min_spend_myr = rules.min_spend_myr;
    conditions.push("total_spend_myr >= :min_spend_myr");
  }
  if (typeof rules.max_spend_myr === "number") {
    params.max_spend_myr = rules.max_spend_myr;
    conditions.push("total_spend_myr <= :max_spend_myr");
  }

  if (typeof rules.inactive_days === "number") {
    // last_purchase_at older than N days OR never purchased.
    // Postgres `now() - interval` form lets the query planner use the
    // (business_id, last_purchase_at) index range.
    params.inactive_days = rules.inactive_days;
    conditions.push(
      "(last_purchase_at IS NULL OR last_purchase_at < (now() - (:inactive_days || ' days')::interval))",
    );
  }

  if (rules.sources && rules.sources.length > 0) {
    params.sources = rules.sources;
    conditions.push("source = ANY(:sources::text[])");
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// supabase-js query-builder mutator.
//
// Mirrors the SQL above using PostgREST filters so the result runs with
// RLS in the caller's authenticated session. The caller is responsible
// for the `business_id`, `deleted_at`, `merged_into_id` filters (every
// existing customers query in M1–M6 sets these already, so duplicating
// here would be redundant).
//
// Generic over the query type so it slots into both `select('*')` and
// `select('*', { count: 'exact', head: true })` (used by member-count
// recompute).
// ─────────────────────────────────────────────────────────────────────────

export interface CustomersQueryLike {
  or(filters: string): CustomersQueryLike;
  overlaps(column: string, value: unknown[]): CustomersQueryLike;
  gte(column: string, value: number | string): CustomersQueryLike;
  lte(column: string, value: number | string): CustomersQueryLike;
  lt(column: string, value: string): CustomersQueryLike;
  is(column: string, value: null | boolean): CustomersQueryLike;
  in(column: string, value: readonly string[]): CustomersQueryLike;
}

/**
 * PostgREST array-literal — `{"a","b"}`. Used inside `.or()` because the
 * builder helpers `.cs(...)` / `.cd(...)` accept a column at a time, not
 * the OR-across-two-columns we want here.
 */
function postgrestArrayLiteral(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")}}`;
}

export function applyRulesToCustomersQuery<Q extends CustomersQueryLike>(
  query: Q,
  rules: SegmentRules,
  now: Date = new Date(),
): Q {
  // Cast to the narrow CustomersQueryLike contract so the rule logic
  // doesn't drag the full PostgrestFilterBuilder generics through.
  // Re-cast on the way out so callers keep their original type.
  let q = query as unknown as CustomersQueryLike;

  const stringTags = new Set<string>();
  for (const t of rules.tags_any ?? []) stringTags.add(t);
  for (const t of rules.manual_tags_any ?? []) stringTags.add(t);

  if (stringTags.size > 0) {
    const arr = postgrestArrayLiteral(Array.from(stringTags));
    q = q.or(`manual_tags.ov.${arr},auto_tags.ov.${arr}`);
  }

  if (rules.auto_tags_any && rules.auto_tags_any.length > 0) {
    const mapped = rules.auto_tags_any.map(autoKeyToCustomerTag);
    q = q.overlaps("auto_tags", mapped);
  }

  if (typeof rules.min_spend_myr === "number") {
    q = q.gte("total_spend_myr", rules.min_spend_myr);
  }
  if (typeof rules.max_spend_myr === "number") {
    q = q.lte("total_spend_myr", rules.max_spend_myr);
  }

  if (typeof rules.inactive_days === "number") {
    // PostgREST `.lt()` is exclusive — matches the "older than N days"
    // wording in spec §3. Customers that have never purchased
    // (last_purchase_at IS NULL) ARE considered inactive and should
    // match; PostgREST's `.or()` lets us express that.
    const cutoff = new Date(
      now.getTime() - rules.inactive_days * 86_400_000,
    ).toISOString();
    q = q.or(`last_purchase_at.is.null,last_purchase_at.lt.${cutoff}`);
  }

  if (rules.sources && rules.sources.length > 0) {
    q = q.in("source", rules.sources);
  }

  return q as unknown as Q;
}
