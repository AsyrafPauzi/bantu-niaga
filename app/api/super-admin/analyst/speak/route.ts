import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { ilmuSynthesizeSpeech } from "@/lib/ai/ilmu-speech";
import { loadNadiaSettings } from "@/lib/super-admin/nadia-load";
import { includesVoiceOutput } from "@/lib/super-admin/nadia-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    text: z.string().trim().min(1).max(8000),
  })
  .strict();

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  const settings = await loadNadiaSettings();
  if (!includesVoiceOutput(settings.reply_mode)) {
    return NextResponse.json({ error: "voice_disabled" }, { status: 403 });
  }

  const rl = consume({
    bucket: "super-admin.nadia.speak",
    identifier: admin.userId,
    limit: 30,
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
    const { audio, contentType } = await ilmuSynthesizeSpeech({
      text: parsed.text,
    });
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "speak_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
