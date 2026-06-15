import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveSegmentMembers,
  SegmentNotFoundError,
} from "@/lib/marketing/segments";

export const dynamic = "force-dynamic";

const PARAM_SHAPE = z.object({ id: z.string().uuid() });
const QUERY_SHAPE = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/marketing/segments/[id]/members
 *
 * Paginated customer rows matching this segment's rules. Pagination
 * is id-keyset (`?cursor=<last id>`) for stability across writes; the
 * response includes `nextCursor=null` when the last page has been
 * reached.
 */
export async function GET(request: Request, ctx: RouteContext) {
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

  const params = await ctx.params;
  const parsedParams = PARAM_SHAPE.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedParams.error.issues },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) rawParams[k] = v;
  let parsedQuery;
  try {
    parsedQuery = QUERY_SHAPE.parse(rawParams);
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

  try {
    const result = await resolveSegmentMembers(
      supabase,
      parsedParams.data.id,
      {
        cursor: parsedQuery.cursor ?? null,
        limit: parsedQuery.limit ?? 50,
      },
    );
    return NextResponse.json({
      data: result.members,
      nextCursor: result.nextCursor,
      segment: {
        id: result.segment.id,
        name: result.segment.name,
        kind: result.segment.kind,
        auto_key: result.segment.auto_key,
      },
    });
  } catch (e) {
    if (e instanceof SegmentNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "members_failed", message: msg },
      { status: 500 },
    );
  }
}
