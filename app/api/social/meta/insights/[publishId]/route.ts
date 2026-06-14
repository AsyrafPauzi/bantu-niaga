import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAccountWithTokenForPublish } from "@/lib/social/load";
import {
  getFbPostInsights,
  getIgMediaInsights,
  MetaApiError,
} from "@/lib/social/meta";
import {
  consume,
  rateLimitHeaders,
} from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";

/**
 * GET /api/social/meta/insights/[publishId]
 *
 * Pulls live insights for a single publish row from the Graph API,
 * writes a fresh row into `social_post_metrics`, and returns the
 * normalised numbers to the caller.
 *
 * Always-fresh by design: the Insights tab calls this on demand
 * (button click); we don't background-sync metrics in v1.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publishId: string }> },
) {
  let user;
  try {
    user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return NextResponse.json(
        { error: "forbidden", reason: "marketing.content access required" },
        { status: 403 },
      );
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  // Defend against accidental UI loops (e.g. an infinite refresh) and
  // against malicious cards. 60 refreshes / minute / user is two per
  // second — well past anything legitimate.
  const rl = consume({
    bucket: "social.insights",
    identifier: `user:${user.id}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      headers: rateLimitHeaders(rl),
    });
  }

  const { publishId } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: pub, error } = await supabase
    .from("social_post_publishes")
    .select(
      "id, business_id, external_post_id, social_account_id, status",
    )
    .eq("business_id", user.businessId)
    .eq("id", publishId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "load_failed", message: error.message },
      { status: 500 },
    );
  }
  if (!pub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (pub.status !== "posted" || !pub.external_post_id) {
    return NextResponse.json(
      {
        error: "not_posted",
        message: "This publish row is not in 'posted' state yet.",
      },
      { status: 409 },
    );
  }

  const acct = await loadAccountWithTokenForPublish(
    supabase,
    user.businessId,
    pub.social_account_id,
  );
  if (!acct || !acct.access_token) {
    return NextResponse.json(
      { error: "account_disconnected" },
      { status: 409 },
    );
  }

  try {
    const insights =
      acct.provider === "facebook"
        ? await getFbPostInsights(pub.external_post_id, acct.access_token)
        : await getIgMediaInsights(pub.external_post_id, acct.access_token);

    const { data: row, error: insertErr } = await supabase
      .from("social_post_metrics")
      .insert({
        business_id: user.businessId,
        publish_id: publishId,
        impressions: insights.impressions,
        reach: insights.reach,
        engaged_users: insights.engaged_users,
        likes: insights.likes,
        comments: insights.comments,
        shares: insights.shares,
        saves: insights.saves,
        video_views: insights.video_views,
        raw_payload: insights.raw as object,
      })
      .select(
        "id, impressions, reach, engaged_users, likes, comments, shares, saves, video_views, fetched_at",
      )
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: "save_failed", message: insertErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { action: "refreshed", metrics: row },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status },
      );
    }
    throw e;
  }
}
