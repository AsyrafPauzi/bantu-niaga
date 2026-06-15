import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BroadcastRow } from "@/lib/marketing/broadcasts";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/broadcasts — list broadcasts for the caller's
 * business, newest first. Returns the cached aggregate counters
 * (`total_recipients`, `sent_count`, `failed_count`) so the list view
 * doesn't have to count recipients per row.
 *
 * POST /api/marketing/broadcasts — create a draft broadcast. The
 * status starts at 'draft' and stays there until the /send route is
 * called.
 */

const BroadcastCreateInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    channel: z.enum(["whatsapp_ctc", "email"]),
    segment_id: z.string().uuid(),
    subject: z.string().trim().min(1).max(200).optional(),
    message_template: z.string().trim().min(1).max(4000),
    coupon_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (v) => v.channel === "email" || v.subject === undefined,
    {
      message: "subject is only allowed for channel='email'",
      path: ["subject"],
    },
  );

const ListQuery = z
  .object({
    status: z
      .enum(["draft", "sending", "sent", "failed", "partially_sent"])
      .optional(),
  })
  .strict();

const BROADCAST_COLS =
  "id, business_id, name, channel, segment_id, subject, message_template, " +
  "coupon_id, status, total_recipients, sent_count, failed_count, " +
  "scheduled_at, sent_at, created_by, created_at, updated_at";

function unauthorized(e: UnauthorizedError) {
  return NextResponse.json(
    { error: "unauthorized", code: e.code },
    { status: 401 },
  );
}

function forbidden() {
  return NextResponse.json(
    { error: "forbidden", reason: "marketing.broadcasts access denied" },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "broadcasts")) return forbidden();

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
    .from("broadcasts")
    .select(BROADCAST_COLS)
    .eq("business_id", user.businessId);
  if (parsed.status) q = q.eq("status", parsed.status);
  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { data: (data ?? []) as unknown as BroadcastRow[] },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e);
    throw e;
  }
  if (!canSurface(user.role, "marketing", "broadcasts")) return forbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = BroadcastCreateInput.parse(body);
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

  // Existence + tenant scope check for the referenced segment. RLS
  // already returns 0 rows for a foreign biz, so a non-result here
  // means either not-found or not-mine — same outcome from the
  // operator's perspective.
  const { data: segment, error: segErr } = await supabase
    .from("customer_segments")
    .select("id, business_id, deleted_at")
    .eq("id", parsed.segment_id)
    .maybeSingle();
  if (segErr) {
    return NextResponse.json(
      { error: "segment_lookup_failed", message: segErr.message },
      { status: 500 },
    );
  }
  if (!segment || segment.deleted_at) {
    return NextResponse.json(
      { error: "segment_not_found", message: "Segment not found in your business." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      channel: parsed.channel,
      segment_id: parsed.segment_id,
      subject: parsed.channel === "email" ? (parsed.subject ?? null) : null,
      message_template: parsed.message_template,
      coupon_id: parsed.coupon_id ?? null,
      created_by: user.id,
    })
    .select(BROADCAST_COLS)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
