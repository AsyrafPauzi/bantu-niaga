import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SegmentRulesSchema,
  type SegmentRules,
} from "@/lib/marketing/segments-rules";

export const dynamic = "force-dynamic";

const SegmentCreateInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    rules: SegmentRulesSchema,
  })
  .strict();

const ListQuery = z
  .object({
    kind: z.enum(["auto", "custom"]).optional(),
  })
  .strict();

interface SegmentListRow {
  id: string;
  business_id: string;
  name: string;
  kind: "auto" | "custom";
  auto_key: string | null;
  rules: SegmentRules | null;
  member_count: number;
  member_count_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/marketing/segments — Marketing v1.1.
 *
 * Returns every non-soft-deleted segment for the caller's business,
 * with auto rows pinned to the top followed by custom rows ordered by
 * recency. Member counts come from the cached column; the resolver
 * refreshes them on detail reads (see GET /[id]).
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

  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) rawParams[k] = v;
  let parsed;
  try {
    parsed = ListQuery.parse(rawParams);
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
  let q = supabase
    .from("customer_segments")
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (parsed.kind) q = q.eq("kind", parsed.kind);

  // Auto rows first (a < c sort puts 'auto' before 'custom'), then
  // newest custom rows first. RLS still enforces tenant scope.
  q = q
    .order("kind", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { data: (data ?? []) as unknown as SegmentListRow[] },
    { status: 200 },
  );
}

/**
 * POST /api/marketing/segments — create a custom segment.
 *
 * Body: { name, rules }. Auto segments are seeded out-of-band and
 * cannot be created via this route (the RLS INSERT policy enforces
 * kind='custom' too).
 */
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

  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = SegmentCreateInput.parse(body);
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
  const { data, error } = await supabase
    .from("customer_segments")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      kind: "custom",
      auto_key: null,
      rules: parsed.rules,
      created_by: user.id,
    })
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
