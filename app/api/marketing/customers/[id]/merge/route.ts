import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mergeBodySchema } from "@/lib/marketing/schemas";

/**
 * POST /api/marketing/customers/[id]/merge — Marketing M2.
 *
 * Manual merge of two customers. The URL `[id]` is treated as the
 * winner by default; the request body MUST also carry explicit
 * `winner_id` + `loser_id` to be unambiguous. The two ids MUST belong
 * to the same business as the caller.
 *
 * The actual merge runs inside the Postgres function
 * `public.marketing_merge_customers(...)` (M2 migration), which in a
 * single transaction:
 *   1. asserts same business
 *   2. asserts loser is not already merged / deleted
 *   3. unions manual_tags + fills in missing fields on the winner
 *   4. re-points every FK registered in `customer_external_refs`
 *   5. tombstones the loser
 *   6. emits one `customer.merged` outbox event
 *
 * We use the service-role client (decisions doc Q3 + mission guardrail)
 * because the re-point step touches FK columns on tables the calling
 * Marketing operator's RLS does not directly cover. The function is
 * SECURITY DEFINER as well, so RLS isn't on the critical path either
 * way — service-role gives us an unambiguous "this is an internal,
 * trusted system call".
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = mergeBodySchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  if (parsed.winner_id !== id && parsed.loser_id !== id) {
    return NextResponse.json(
      {
        error: "id_mismatch",
        message:
          "URL [id] must match either winner_id or loser_id in the body.",
      },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc(
    "marketing_merge_customers",
    {
      p_business_id: user.businessId,
      p_winner_id: parsed.winner_id,
      p_loser_id: parsed.loser_id,
      p_actor_user_id: user.id,
    },
  );

  if (error) {
    if (error.code === "P0001") {
      switch (error.message) {
        case "already_merged":
          return NextResponse.json(
            {
              error: "already_merged",
              message: "Loser is already merged into another customer.",
            },
            { status: 409 },
          );
        case "winner_not_found":
        case "loser_not_found":
          return NextResponse.json(
            { error: "not_found", message: error.message },
            { status: 404 },
          );
        case "cross_business":
          return NextResponse.json(
            {
              error: "cross_business",
              message: "Customers belong to different businesses.",
            },
            { status: 403 },
          );
        case "winner_deleted":
        case "loser_deleted":
        case "winner_already_merged":
        case "same_customer":
          return NextResponse.json(
            { error: error.message, message: error.message },
            { status: 400 },
          );
        default:
          return NextResponse.json(
            { error: "merge_failed", message: error.message },
            { status: 500 },
          );
      }
    }
    return NextResponse.json(
      { error: "merge_failed", message: error.message },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as
        | {
            winner_id?: string;
            loser_id?: string;
            event_id?: string;
            repointed?: Array<{ table_name: string; fk_column: string; rows: number }>;
          }
        | undefined)
    : (data as
        | {
            winner_id?: string;
            loser_id?: string;
            event_id?: string;
            repointed?: Array<{ table_name: string; fk_column: string; rows: number }>;
          }
        | null);

  return NextResponse.json(
    {
      action: "merged",
      winner_id: row?.winner_id ?? parsed.winner_id,
      loser_id: row?.loser_id ?? parsed.loser_id,
      event_id: row?.event_id ?? null,
      repointed: row?.repointed ?? [],
    },
    { status: 200 },
  );
}
