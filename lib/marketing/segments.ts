/**
 * Bantu Niaga — Marketing v1.1 segments server-side helpers.
 *
 * Server-only: do NOT import from client components.
 *
 * Exports:
 *   - resolveSegmentMembers — paginated customer rows matching a segment
 *   - recomputeMemberCount  — refresh the cached member_count column
 *   - seedAutoSegmentsForBusiness — used by the migration (via INSERT
 *     SELECT) and by future business-create flows to seed the five
 *     auto rows
 *
 * All helpers run through the supabase-js query builder so RLS applies
 * to the caller's session by default. `seedAutoSegmentsForBusiness`
 * is the one exception — it expects a service-role client because the
 * auto rows are not user-creatable (the INSERT policy rejects
 * kind='auto' for owner/manager too).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyRulesToCustomersQuery,
  AUTO_KEY_LABEL,
  AUTO_SEGMENT_KEYS,
  autoSegmentRules,
  isSegmentRules,
  type AutoSegmentKey,
  type CustomersQueryLike,
  type SegmentRules,
} from "@/lib/marketing/segments-rules";

// ─────────────────────────────────────────────────────────────────────────
// Shared row shapes
// ─────────────────────────────────────────────────────────────────────────

export interface SegmentRow {
  id: string;
  business_id: string;
  name: string;
  kind: "auto" | "custom";
  auto_key: AutoSegmentKey | null;
  rules: SegmentRules | null;
  member_count: number;
  member_count_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SegmentMemberRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  manual_tags: string[];
  auto_tags: string[];
  total_spend_myr: number;
  order_count: number;
  last_purchase_at: string | null;
}

const MEMBER_SELECT =
  "id, name, phone_e164, email, manual_tags, auto_tags, " +
  "total_spend_myr, order_count, last_purchase_at";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve a segment row's rules object — auto segments synthesise from
 * `auto_key`, custom segments parse the `rules` JSONB column.
 *
 * Throws when a custom segment has an invalid rules payload (data
 * corruption / migration bug). Falls back to "empty rules" on auto
 * segments missing an auto_key (defensive — the DB CHECK forbids this).
 */
export function rulesForSegment(segment: Pick<SegmentRow, "kind" | "auto_key" | "rules">): SegmentRules {
  if (segment.kind === "auto") {
    if (segment.auto_key === null) return {};
    return autoSegmentRules(segment.auto_key);
  }
  if (!isSegmentRules(segment.rules)) {
    throw new Error(
      `segment.rules is not a valid SegmentRules object: ${JSON.stringify(
        segment.rules,
      )}`,
    );
  }
  return segment.rules;
}

// ─────────────────────────────────────────────────────────────────────────
// resolveSegmentMembers
// ─────────────────────────────────────────────────────────────────────────

export interface ResolveSegmentMembersOpts {
  /** Page size. Clamped to [1, 200]. Default 50. */
  limit?: number;
  /**
   * Opaque cursor returned by the previous call's `nextCursor`. Stable
   * id-based pagination; rows are ordered by `customers.id` ASC for
   * deterministic paging across runs.
   */
  cursor?: string | null;
}

export interface ResolveSegmentMembersResult {
  members: SegmentMemberRow[];
  nextCursor: string | null;
  /** Same business as the segment — convenience for the API route. */
  businessId: string;
  segment: SegmentRow;
}

/**
 * Page through the customers matching a segment.
 *
 * Pagination is id-based keyset (`id > :cursor`). Stable, RLS-friendly,
 * and avoids the OFFSET-scan cost as the customer base grows.
 *
 * RLS: the caller's supabase client MUST be the authenticated server
 * client (createSupabaseServerClient). Service-role callers bypass
 * tenant scoping and will leak rows; use seedAutoSegmentsForBusiness
 * instead for service-role paths.
 */
export async function resolveSegmentMembers(
  supabase: SupabaseClient,
  segmentId: string,
  opts: ResolveSegmentMembersOpts = {},
): Promise<ResolveSegmentMembersResult> {
  const { data: rawSegment, error: segErr } = await supabase
    .from("customer_segments")
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_by, created_at, updated_at, deleted_at",
    )
    .eq("id", segmentId)
    .maybeSingle();

  if (segErr) {
    throw new Error(`failed to load segment ${segmentId}: ${segErr.message}`);
  }
  if (!rawSegment) {
    throw new SegmentNotFoundError(segmentId);
  }
  const segment = rawSegment as unknown as SegmentRow;

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rules = rulesForSegment(segment);

  let query = supabase
    .from("customers")
    .select(MEMBER_SELECT)
    .eq("business_id", segment.business_id)
    .is("deleted_at", null)
    .is("merged_into_id", null);

  query = applyRulesToCustomersQuery(query, rules);

  if (opts.cursor) {
    query = query.gt("id", opts.cursor);
  }

  // Fetch one extra row to know whether there's a next page without a
  // separate count query.
  query = query.order("id", { ascending: true }).limit(limit + 1);

  const { data, error } = await query;
  if (error) {
    throw new Error(`failed to resolve members: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as SegmentMemberRow[];
  const hasMore = rows.length > limit;
  const members = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? members[members.length - 1].id : null;

  return {
    members,
    nextCursor,
    businessId: segment.business_id,
    segment,
  };
}

export class SegmentNotFoundError extends Error {
  constructor(segmentId: string) {
    super(`segment ${segmentId} not found`);
    this.name = "SegmentNotFoundError";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// recomputeMemberCount
// ─────────────────────────────────────────────────────────────────────────

export interface RecomputeMemberCountResult {
  count: number;
  segment: SegmentRow;
}

/**
 * Recount the segment's matching customers and update the cached columns.
 *
 * The recount uses a `head: true, count: 'exact'` select for efficiency
 * (no row payload over the wire). The update only writes if either
 * `member_count` or `member_count_at` would actually change to avoid
 * spurious trigger churn on the `set_updated_at` trigger.
 */
export async function recomputeMemberCount(
  supabase: SupabaseClient,
  segmentId: string,
): Promise<RecomputeMemberCountResult> {
  const { data: rawSegment, error: segErr } = await supabase
    .from("customer_segments")
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_by, created_at, updated_at, deleted_at",
    )
    .eq("id", segmentId)
    .maybeSingle();
  if (segErr) {
    throw new Error(`failed to load segment ${segmentId}: ${segErr.message}`);
  }
  if (!rawSegment) {
    throw new SegmentNotFoundError(segmentId);
  }
  const segment = rawSegment as unknown as SegmentRow;
  const rules = rulesForSegment(segment);

  const countQueryRaw = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", segment.business_id)
    .is("deleted_at", null)
    .is("merged_into_id", null);
  // Funnel through the narrow CustomersQueryLike surface so the
  // PostgrestFilterBuilder generics don't explode (TS2589). The
  // identity is preserved — supabase-js still uses the original builder
  // under the hood.
  const countQuery = applyRulesToCustomersQuery(
    countQueryRaw as unknown as CustomersQueryLike,
    rules,
  ) as unknown as typeof countQueryRaw;

  const { count, error: countErr } = await countQuery;
  if (countErr) {
    throw new Error(`failed to count members: ${countErr.message}`);
  }
  const memberCount = count ?? 0;

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("customer_segments")
    .update({ member_count: memberCount, member_count_at: nowIso })
    .eq("id", segmentId);
  if (updateErr) {
    // Auto segments can be updated by the API via server-side helpers
    // (they still run under the caller's RLS context). If the update
    // fails because the row is auto and the UPDATE policy excludes
    // kind='auto', we surface a clear error so callers can skip the
    // cache-refresh quietly for auto rows.
    throw new MemberCountUpdateError(
      `failed to update member_count on ${segmentId}: ${updateErr.message}`,
      memberCount,
    );
  }

  return {
    count: memberCount,
    segment: { ...segment, member_count: memberCount, member_count_at: nowIso },
  };
}

export class MemberCountUpdateError extends Error {
  readonly count: number;
  constructor(message: string, count: number) {
    super(message);
    this.name = "MemberCountUpdateError";
    this.count = count;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// seedAutoSegmentsForBusiness
//
// Idempotent: re-running produces zero new rows because of the
// (business_id, auto_key) unique constraint. Requires a service-role
// client because the INSERT RLS policy rejects kind='auto' even for
// owners (auto rows are seeded out-of-band).
// ─────────────────────────────────────────────────────────────────────────

export async function seedAutoSegmentsForBusiness(
  serviceRoleClient: SupabaseClient,
  businessId: string,
): Promise<{ inserted: number }> {
  const rows = AUTO_SEGMENT_KEYS.map((key) => ({
    business_id: businessId,
    name: AUTO_KEY_LABEL[key],
    kind: "auto" as const,
    auto_key: key,
  }));

  const { data, error } = await serviceRoleClient
    .from("customer_segments")
    .upsert(rows, {
      onConflict: "business_id,auto_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    throw new Error(
      `failed to seed auto segments for ${businessId}: ${error.message}`,
    );
  }

  return { inserted: (data ?? []).length };
}
