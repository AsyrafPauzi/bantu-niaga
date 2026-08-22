import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMarketingSurface } from "@/lib/marketing/require-user";
import { rewriteCaptionWithMaya } from "@/lib/ai/maya-caption-rewrite";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  channel: z.enum(["tiktok", "instagram", "facebook"]),
  caption: z.string().trim().min(1).max(4000),
  hook: z.string().trim().max(280).nullable().optional(),
  hashtags: z.array(z.string().max(64)).max(20).optional(),
});

/**
 * POST /api/marketing/content/rewrite
 *
 * Maya caption rewrite using marketing/commerce context. Charges Maya chat
 * credits. Never returns fabricated copy on failure — explicit error codes.
 */
export async function POST(request: Request) {
  const auth = await requireMarketingSurface("content");
  if (auth.response) return auth.response;
  const { user } = auth;

  const rl = consume({
    bucket: "marketing.content.rewrite",
    identifier: `user:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      headers: rateLimitHeaders(rl),
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Expected JSON body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await rewriteCaptionWithMaya({
    channel: parsed.data.channel,
    caption: parsed.data.caption,
    hook: parsed.data.hook,
    hashtags: parsed.data.hashtags,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message,
        marketplace_href: result.marketplace_href,
        billing_href: result.billing_href,
        credit_balance: result.credit_balance,
      },
      {
        status: result.status,
        headers: rateLimitHeaders(rl),
      },
    );
  }

  return NextResponse.json(
    {
      caption: result.caption,
      credits: result.credits,
    },
    { status: 200, headers: rateLimitHeaders(rl) },
  );
}
