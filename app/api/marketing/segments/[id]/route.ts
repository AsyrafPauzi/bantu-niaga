import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SegmentRulesSchema } from "@/lib/marketing/segments-rules";
import {
  MemberCountUpdateError,
  recomputeMemberCount,
  SegmentNotFoundError,
} from "@/lib/marketing/segments";

export const dynamic = "force-dynamic";

const SegmentPatchInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    rules: SegmentRulesSchema.optional(),
  })
  .strict()
  .refine(
    (v) => v.name !== undefined || v.rules !== undefined,
    {
      message: "must include at least one of name, rules",
      path: ["name"],
    },
  );

const PARAM_SHAPE = z.object({ id: z.string().uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireUser() {
  try {
    return await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      throw e;
    }
    throw e;
  }
}

function unauthorizedResponse(e: UnauthorizedError) {
  return NextResponse.json(
    { error: "unauthorized", code: e.code },
    { status: 401 },
  );
}

/**
 * GET /api/marketing/segments/[id] — segment detail with fresh count.
 *
 * Recomputes `member_count` on the way out so the operator sees an
 * up-to-date number every time they open a segment. For auto segments
 * the UPDATE may fail under RLS (kind='auto' is excluded from the
 * UPDATE policy) — we surface the freshly-counted number anyway and
 * silently skip the cache write.
 */
export async function GET(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { count, segment } = await recomputeMemberCount(
      supabase,
      parsedParams.data.id,
    );
    return NextResponse.json({ data: { ...segment, member_count: count } });
  } catch (e) {
    if (e instanceof SegmentNotFoundError) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 },
      );
    }
    if (e instanceof MemberCountUpdateError) {
      // Auto segments can't be UPDATEd via RLS — fall back to a plain
      // read + the freshly-counted number.
      const { data: row } = await supabase
        .from("customer_segments")
        .select(
          "id, business_id, name, kind, auto_key, rules, member_count, " +
            "member_count_at, created_at, updated_at",
        )
        .eq("id", parsedParams.data.id)
        .maybeSingle();
      if (!row) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      const rowObj = row as unknown as Record<string, unknown>;
      return NextResponse.json({
        data: { ...rowObj, member_count: e.count },
      });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "detail_failed", message: msg },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/marketing/segments/[id] — edit a custom segment.
 *
 * Auto segments are immutable: returns 409 with reason="auto_immutable"
 * before any DB write so the operator sees a clean error. The RLS
 * UPDATE policy enforces the same guarantee.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
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
    parsed = SegmentPatchInput.parse(body);
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

  const { data: existing, error: lookupErr } = await supabase
    .from("customer_segments")
    .select("id, kind, deleted_at")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.deleted_at) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.kind === "auto") {
    return NextResponse.json(
      {
        error: "auto_immutable",
        reason: "Auto segments are seeded by the system and cannot be edited.",
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.rules !== undefined) patch.rules = parsed.rules;

  const { data, error } = await supabase
    .from("customer_segments")
    .update(patch)
    .eq("id", parsedParams.data.id)
    .select(
      "id, business_id, name, kind, auto_key, rules, member_count, " +
        "member_count_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

/**
 * DELETE /api/marketing/segments/[id] — soft-delete (custom only).
 *
 * Auto segments return 409. Custom rows set deleted_at = now() so the
 * default SELECT path hides them. Re-creating with the same name is
 * allowed (no unique constraint on name).
 */
export async function DELETE(_request: Request, ctx: RouteContext) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "segments")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.segments access denied" },
      { status: 403 },
    );
  }

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("customer_segments")
    .select("id, kind, deleted_at")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: "detail_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.deleted_at) {
    return NextResponse.json({ ok: true, already_deleted: true });
  }
  if (existing.kind === "auto") {
    return NextResponse.json(
      {
        error: "auto_immutable",
        reason: "Auto segments are seeded by the system and cannot be deleted.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("customer_segments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsedParams.data.id);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
