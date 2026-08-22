import { NextResponse } from "next/server";
import { requireMarketingSurface } from "@/lib/marketing/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveAudienceBestTime,
  type ContentChannel,
} from "@/lib/social/audience-best-time";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/content/best-time?channel=instagram|facebook|tiktok
 *
 * Returns Meta audience-online peak window when the channel account is
 * connected. Never invents timing — unavailable states are explicit.
 */
export async function GET(request: Request) {
  const auth = await requireMarketingSurface("content");
  if (auth.response) return auth.response;
  const { user } = auth;

  const rl = consume({
    bucket: "marketing.content.best_time",
    identifier: `user:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      headers: rateLimitHeaders(rl),
    });
  }

  const url = new URL(request.url);
  const channelRaw = url.searchParams.get("channel") ?? "instagram";
  const channel = (
    ["tiktok", "instagram", "facebook"] as const
  ).find((c) => c === channelRaw) as ContentChannel | undefined;

  if (!channel) {
    return NextResponse.json(
      { error: "validation_failed", message: "Invalid channel." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const result = await resolveAudienceBestTime({
    client: supabase,
    businessId: user.businessId,
    channel,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: rateLimitHeaders(rl),
  });
}
