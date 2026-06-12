import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerCreateInput, ListQuerySchema } from "@/lib/marketing/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import { dedupCustomer } from "@/lib/marketing/dedup";

/**
 * POST /api/marketing/customers — Marketing M1.
 *
 * Spec: docs/plans/marketing-implementation-plan.md §4.1 + §4.2.1.
 *
 * Pipeline:
 *   1. Validate body with Zod.
 *   2. Auth via getCurrentUser(); 401 on no session.
 *   3. RBAC via canSurface(role, 'marketing', 'customers'); 403 on deny.
 *   4. Normalize phone — if it was provided but unparseable → 400.
 *   5. Dedup. On `merge` → return without insert. On `prompt` → return
 *      the existing-match payload without insert (the calling UI shows
 *      the prompt; if the operator confirms a fresh row, they re-POST
 *      with a different name or call the merge endpoint).
 *   6. On `new` → call the `marketing_create_customer` RPC, which inserts
 *      the customer row AND the `customer.created` outbox row in the
 *      same Postgres transaction.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/customers — desktop CRM list (Marketing M2 §4.A).
 *
 * Pagination via `?page=&pageSize=` (default 50, max 200).
 * Filters: `q` (name / phone fuzzy), `tags` (CSV — matches against either
 * `auto_tags` or `manual_tags`), `source`, `last_purchase_{before,after}`,
 * `min_spend`, `max_spend`. Sort: `name | last_purchase_at |
 * total_spend_myr` × `asc | desc`. Soft-deleted rows are filtered by
 * RLS (see `customers_select_self_business`).
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.customers access denied" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    rawParams[k] = v;
  }

  let parsed;
  try {
    parsed = ListQuerySchema.parse(rawParams);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, address, manual_tags, auto_tags, " +
        "notes, source, total_spend_myr, last_purchase_at, order_count, " +
        "aov_myr, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null);

  if (parsed.q) {
    const safe = escapePostgrestPattern(parsed.q);
    query = query.or(
      `name.ilike.*${safe}*,phone_e164.ilike.*${safe}*`,
    );
  }

  if (parsed.tags && parsed.tags.length > 0) {
    const tagList = `{${parsed.tags
      .map((t) => `"${t.replace(/"/g, '\\"')}"`)
      .join(",")}}`;
    query = query.or(
      `auto_tags.ov.${tagList},manual_tags.ov.${tagList}`,
    );
  }

  if (parsed.source) {
    query = query.eq("source", parsed.source);
  }

  if (parsed.last_purchase_before) {
    query = query.lt("last_purchase_at", parsed.last_purchase_before);
  }
  if (parsed.last_purchase_after) {
    query = query.gt("last_purchase_at", parsed.last_purchase_after);
  }
  if (typeof parsed.min_spend === "number") {
    query = query.gte("total_spend_myr", parsed.min_spend);
  }
  if (typeof parsed.max_spend === "number") {
    query = query.lte("total_spend_myr", parsed.max_spend);
  }

  query = query.order(parsed.sort, {
    ascending: parsed.order === "asc",
    nullsFirst: false,
  });

  const from = (parsed.page - 1) * parsed.pageSize;
  const to = from + parsed.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      data: data ?? [],
      page: parsed.page,
      pageSize: parsed.pageSize,
      total: count ?? 0,
    },
    { status: 200 },
  );
}

/**
 * PostgREST treats `*` as a wildcard in `ilike` patterns. Escape any
 * existing `*`, `,`, `(`, `)` in user input so the filter expression
 * stays parseable. We also strip backslashes (the only escape character
 * PostgREST honours inside `or=(...)`).
 */
function escapePostgrestPattern(input: string): string {
  return input.replace(/[\\*,()]/g, "");
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.customers access denied" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = CustomerCreateInput.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  let phoneE164: string | null = null;
  if (parsed.phone && parsed.phone.length > 0) {
    phoneE164 = normalizeMyPhone(parsed.phone);
    if (phoneE164 === null) {
      return NextResponse.json(
        {
          error: "invalid_phone",
          message:
            "Phone could not be parsed as E.164. Use +60… for international or 0… for Malaysian local format.",
        },
        { status: 400 },
      );
    }
  }

  const supabase = await createSupabaseServerClient();

  // `force_create: true` lets the UI bypass the dedup `prompt` branch
  // after the operator chose "Keep separate" from <MergePromptBanner>.
  // We still run dedup so an exact-name match auto-merges (a
  // user-friendly safety net: if the names actually agree, "Keep
  // separate" is a misclick).
  const dedup = await dedupCustomer(
    {
      phone: phoneE164,
      name: parsed.name,
      businessId: user.businessId,
    },
    supabase,
  );

  if (dedup.action === "merge" && dedup.existingCustomerId) {
    return NextResponse.json(
      {
        action: "merged",
        customer_id: dedup.existingCustomerId,
        existing_name: dedup.existingName ?? null,
      },
      { status: 200 },
    );
  }

  if (dedup.action === "prompt" && dedup.existingCustomerId && !parsed.force_create) {
    return NextResponse.json(
      {
        action: "prompt",
        existing_customer_id: dedup.existingCustomerId,
        existing_name: dedup.existingName ?? null,
      },
      { status: 200 },
    );
  }

  // If the operator chose "Keep separate" (force_create=true) but the phone
  // collides with an existing live customer in this business, the phone
  // belongs to the survivor — the unique-phone partial index would block
  // a second INSERT. Drop the phone on the new row so the create succeeds.
  // The operator can edit the phone later from the new profile.
  let insertPhone = phoneE164;
  if (
    parsed.force_create &&
    (dedup.action === "merge" || dedup.action === "prompt") &&
    dedup.existingCustomerId
  ) {
    insertPhone = null;
  }

  const { data, error } = await supabase.rpc("marketing_create_customer", {
    p_business_id: user.businessId,
    p_name: parsed.name,
    p_phone_e164: insertPhone,
    p_email: parsed.email ?? null,
    p_address: parsed.address ?? null,
    p_manual_tags: parsed.manual_tags ?? [],
    p_notes: parsed.notes ?? null,
    p_source: parsed.source,
    p_created_by_user_id: user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as { customer_id?: string; event_id?: string } | undefined)
    : (data as { customer_id?: string; event_id?: string } | null);
  const customerId = row?.customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "insert_failed", message: "RPC returned no customer id" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      action: "created",
      customer_id: customerId,
      event_id: row?.event_id ?? null,
    },
    { status: 201 },
  );
}
