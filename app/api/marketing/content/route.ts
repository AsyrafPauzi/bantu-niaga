import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  contentEntryCreateSchema,
  contentListQuerySchema,
} from "@/lib/marketing/schemas";

/**
 * /api/marketing/content — Marketing M5.
 *
 * Spec: docs/plans/marketing-implementation-plan.md §4.2.7 and §11 M5.
 *
 *   GET  → list / month / status / channel filter.
 *   POST → create entry + optional initial media attachments.
 *
 * Per the locked decisions doc, v1 is plan-only: no auto-post, no
 * cross-pillar event emission for content_plan rows. RBAC: `owner` and
 * `manager` (the matrix grants Marketing `*` to both). All other roles
 * return 403. RLS provides defense-in-depth.
 */

export const dynamic = "force-dynamic";

async function requireUser() {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "marketing.content access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: e.code },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

const CONTENT_SELECT =
  "id, business_id, channel, status, scheduled_at, hook, caption, " +
  "created_by, posted_at, created_at, updated_at";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    rawParams[k] = v;
  }

  let parsed;
  try {
    parsed = contentListQuerySchema.parse(rawParams);
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
    .from("content_plan")
    .select(CONTENT_SELECT)
    .eq("business_id", user.businessId);

  if (parsed.channel) query = query.eq("channel", parsed.channel);
  if (parsed.status) query = query.eq("status", parsed.status);

  if (parsed.year !== undefined && parsed.month !== undefined) {
    // The calendar grid stores dates in UTC; the page renders them in
    // Asia/Kuala_Lumpur. To pick "this month" in MYT we treat the month
    // as the [start-of-month-in-MYT, start-of-next-month-in-MYT) window
    // expressed in UTC. MYT = UTC+8 has no DST so the conversion is a
    // fixed -8h offset.
    const startUtc = new Date(
      Date.UTC(parsed.year, parsed.month - 1, 1, -8, 0, 0),
    );
    const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
    const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
    const endUtc = new Date(Date.UTC(nextYear, nextMonth - 1, 1, -8, 0, 0));
    query = query
      .gte("scheduled_at", startUtc.toISOString())
      .lt("scheduled_at", endUtc.toISOString());
  }

  query = query
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const { data: rawRows, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  // Cast through unknown to a known row shape — Supabase JS's untyped
  // `.select(<string>)` returns a parser-error union by default, which
  // doesn't help the call site.
  const rows = (rawRows ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;

  // Fetch media in a single follow-up query so the calendar can show a
  // thumbnail count per entry without N+1.
  const ids = rows.map((r) => r.id);
  const mediaByEntry: Record<string, Array<{ file_id: string; position: number }>> =
    {};
  if (ids.length > 0) {
    const { data: mediaRaw } = await supabase
      .from("content_plan_media")
      .select("content_plan_id, file_id, position")
      .eq("business_id", user.businessId)
      .in("content_plan_id", ids)
      .order("position", { ascending: true });
    const mediaRows = (mediaRaw ?? []) as unknown as Array<{
      content_plan_id: string;
      file_id: string;
      position: number;
    }>;
    for (const row of mediaRows) {
      (mediaByEntry[row.content_plan_id] ??= []).push({
        file_id: row.file_id,
        position: row.position,
      });
    }
  }

  const enriched = rows.map((row) => ({
    ...row,
    media: mediaByEntry[row.id] ?? [],
  }));

  return NextResponse.json(
    { data: enriched, total: enriched.length },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = contentEntryCreateSchema.parse(body);
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

  const postedAt =
    parsed.status === "posted" ? new Date().toISOString() : null;

  const { data: inserted, error: insErr } = await supabase
    .from("content_plan")
    .insert({
      business_id: user.businessId,
      channel: parsed.channel,
      status: parsed.status,
      scheduled_at: parsed.scheduled_at ?? null,
      hook: parsed.hook ?? null,
      caption: parsed.caption ?? null,
      created_by: user.id,
      posted_at: postedAt,
    })
    .select(CONTENT_SELECT)
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      {
        error: "insert_failed",
        message: insErr?.message ?? "no row returned",
      },
      { status: 500 },
    );
  }

  const insertedRow = inserted as unknown as { id: string };
  // Attach any media file_ids submitted with the create payload.
  if (parsed.media_file_ids && parsed.media_file_ids.length > 0) {
    const mediaRows = parsed.media_file_ids.map((file_id, i) => ({
      content_plan_id: insertedRow.id,
      file_id,
      business_id: user.businessId,
      position: i,
    }));
    const { error: mediaErr } = await supabase
      .from("content_plan_media")
      .insert(mediaRows);
    if (mediaErr) {
      // The entry already exists; surface a soft warning instead of
      // tearing down the row. Operator can re-attach manually.
      return NextResponse.json(
        {
          action: "created",
          entry: inserted,
          media_warning: mediaErr.message,
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json(
    { action: "created", entry: inserted },
    { status: 201 },
  );
}
