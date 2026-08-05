import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { runNadiaChat } from "@/lib/super-admin/analyst-chat";
import { logNadiaAudit } from "@/lib/super-admin/nadia-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    message: z.string().trim().min(1).max(4000),
  })
  .strict();

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();

  const rl = consume({
    bucket: "super-admin.nadia.chat",
    identifier: admin.userId,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  try {
    const result = await runNadiaChat(parsed.message);

    await logNadiaAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "nadia.query",
      diff: {
        reply_mode: result.replyMode,
        cost_myr_estimated: result.costMyrEstimated,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        tts_chars: result.voiceScript?.length ?? 0,
        voice_generated: result.voiceGenerated,
        tts_error: result.ttsError,
        question_length: parsed.message.length,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      reply: result.showText ? result.reply : null,
      transcript: result.showText ? null : result.reply,
      voiceScript: result.voiceScript,
      audioBase64: result.audioBase64,
      audioContentType: result.audioContentType,
      replyMode: result.replyMode,
      showText: result.showText,
      showVoice: result.showVoice,
      voiceAutoPlay: result.voiceAutoPlay,
      costMyrEstimated: result.costMyrEstimated,
      voiceGenerated: result.voiceGenerated,
      ttsError: result.ttsError,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "chat_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
