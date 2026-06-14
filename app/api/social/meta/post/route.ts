import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAccountWithTokenForPublish } from "@/lib/social/load";
import {
  MetaApiError,
  publishFacebookPagePost,
  publishInstagramPost,
} from "@/lib/social/meta";
import {
  consume,
  rateLimitHeaders,
} from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";
import { logger } from "@/lib/logger";

/**
 * POST /api/social/meta/post
 *
 * Publish a content_plan entry to one or more connected social_accounts.
 *
 * Body:
 *   {
 *     contentPlanId: uuid,
 *     accountIds:    uuid[]              // one or more social_accounts
 *     captionOverride?: string,          // optional override
 *     imageUrl?: string,                 // public URL — required for IG
 *     scheduledAt?: ISO timestamp        // optional, FB only
 *   }
 *
 * Behaviour:
 *   - Loads the content_plan row, denying if it doesn't belong to the tenant.
 *   - For each accountId, opens a publish row with status='queued', then
 *     calls the Graph API. On success the row flips to 'posted' with the
 *     external_post_id + permalink. On failure it flips to 'failed' with
 *     the error_message. We never throw 500 unless something REALLY broke;
 *     partial successes are reported back as a per-account result list.
 *   - When at least one publish succeeds, we also flip the content_plan
 *     row to status='posted' so the calendar reflects reality.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contentPlanId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1).max(10),
  captionOverride: z.string().max(2200).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

interface PerAccountResult {
  accountId: string;
  publishId: string;
  status: "posted" | "failed";
  externalPostId?: string;
  permalink?: string;
  error?: string;
}

const log = logger.child({ module: "social.meta.post" });

export async function POST(request: Request) {
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

  // Throttle outbound Graph publish so a runaway client (or compromised
  // session) cannot exhaust the per-Page rate limit at Meta. 30 posts /
  // minute / user is well above any legitimate creative cadence.
  const rl = consume({
    bucket: "social.publish",
    identifier: `user:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    log.warn("rate_limited", {
      userId: user.id,
      retryAfterSeconds: rl.retryAfterSeconds,
    });
    return tooManyRequests(rl.retryAfterSeconds, {
      headers: rateLimitHeaders(rl),
    });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
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

  // Load the content_plan row (tenant-scoped via RLS).
  const { data: entry, error: entryErr } = await supabase
    .from("content_plan")
    .select("id, hook, caption, channel, status")
    .eq("business_id", user.businessId)
    .eq("id", parsed.contentPlanId)
    .maybeSingle();

  if (entryErr) {
    return NextResponse.json(
      { error: "load_failed", message: entryErr.message },
      { status: 500 },
    );
  }
  if (!entry) {
    return NextResponse.json(
      { error: "not_found", message: "content_plan row not found" },
      { status: 404 },
    );
  }

  const caption = (
    parsed.captionOverride ??
    [entry.hook, entry.caption].filter(Boolean).join("\n\n")
  ).trim();

  const scheduledAtUnix = parsed.scheduledAt
    ? Math.floor(new Date(parsed.scheduledAt).getTime() / 1000)
    : undefined;

  const results: PerAccountResult[] = [];

  for (const accountId of parsed.accountIds) {
    const acct = await loadAccountWithTokenForPublish(
      supabase,
      user.businessId,
      accountId,
    );

    if (!acct || acct.status !== "active" || !acct.access_token) {
      results.push({
        accountId,
        publishId: "",
        status: "failed",
        error: !acct
          ? "Account not found"
          : acct.status !== "active"
            ? `Account is ${acct.status}`
            : "Missing access token — reconnect required",
      });
      continue;
    }

    // Open a queued publish row first so the audit trail is intact even
    // if Graph errors out half-way through.
    const { data: publishRow, error: insertErr } = await supabase
      .from("social_post_publishes")
      .insert({
        business_id: user.businessId,
        content_plan_id: parsed.contentPlanId,
        social_account_id: accountId,
        status: "queued",
        caption_snapshot: caption,
        created_by_user_id: user.id,
      })
      .select("id")
      .single();

    if (insertErr || !publishRow) {
      results.push({
        accountId,
        publishId: "",
        status: "failed",
        error: insertErr?.message ?? "Failed to record publish",
      });
      continue;
    }

    try {
      if (acct.provider === "facebook") {
        const r = await publishFacebookPagePost({
          pageId: acct.external_id,
          pageToken: acct.access_token,
          message: caption,
          imageUrl: parsed.imageUrl ?? null,
          scheduledPublishTime: scheduledAtUnix,
        });
        await supabase
          .from("social_post_publishes")
          .update({
            status: "posted",
            external_post_id: r.id,
            permalink: r.permalink_url ?? null,
            posted_at: new Date().toISOString(),
          })
          .eq("id", publishRow.id);
        results.push({
          accountId,
          publishId: publishRow.id,
          status: "posted",
          externalPostId: r.id,
          permalink: r.permalink_url,
        });
      } else {
        // Instagram requires a public image URL.
        if (!parsed.imageUrl) {
          throw new MetaApiError(
            "Instagram requires a public image URL — text-only posts are not supported by the Graph API.",
            "ig_no_media",
            400,
          );
        }
        const r = await publishInstagramPost({
          igUserId: acct.external_id,
          pageToken: acct.access_token,
          imageUrl: parsed.imageUrl,
          caption,
        });
        await supabase
          .from("social_post_publishes")
          .update({
            status: "posted",
            external_post_id: r.id,
            permalink: r.permalink ?? null,
            posted_at: new Date().toISOString(),
          })
          .eq("id", publishRow.id);
        results.push({
          accountId,
          publishId: publishRow.id,
          status: "posted",
          externalPostId: r.id,
          permalink: r.permalink,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabase
        .from("social_post_publishes")
        .update({ status: "failed", error_message: msg })
        .eq("id", publishRow.id);
      results.push({
        accountId,
        publishId: publishRow.id,
        status: "failed",
        error: msg,
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "posted").length;

  // If anything succeeded and the content_plan row is not already
  // 'posted', advance it. We do not auto-rollback on partial failures.
  if (succeeded > 0 && entry.status !== "posted") {
    await supabase
      .from("content_plan")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
      })
      .eq("business_id", user.businessId)
      .eq("id", parsed.contentPlanId);
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "social.meta.publish",
    entity_type: "content_plan",
    entity_id: parsed.contentPlanId,
    diff: {
      requested: parsed.accountIds.length,
      succeeded,
      failed: results.length - succeeded,
    },
  });

  return NextResponse.json(
    { action: "published", succeeded, results },
    { status: 200 },
  );
}
