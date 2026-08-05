import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { ilmuTranscribeAudio } from "@/lib/ai/ilmu-speech";
import { logNadiaAudit } from "@/lib/super-admin/nadia-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_BASE = new Set([
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/x-m4a",
  "audio/m4a",
]);

function normalizeAudioMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  return ALLOWED_MIME_BASE.has(base) ? base : mime;
}

function isAllowedAudioMime(mime: string): boolean {
  const base = mime.split(";")[0]?.trim().toLowerCase() || "";
  return ALLOWED_MIME_BASE.has(base);
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();

  const rl = consume({
    bucket: "super-admin.nadia.transcribe",
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

  const form = await request.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 400 });
  }
  const mime = file.type || "audio/webm";
  if (!isAllowedAudioMime(mime)) {
    return NextResponse.json({ error: "unsupported_audio_type" }, { status: 400 });
  }
  const normalizedMime = normalizeAudioMime(mime);

  try {
    const { transcript } = await ilmuTranscribeAudio({
      audio: file,
      mimeType: normalizedMime,
      filename: normalizedMime.includes("mp4") || normalizedMime.includes("m4a")
        ? "recording.m4a"
        : "recording.webm",
    });

    await logNadiaAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "nadia.transcribe",
      diff: { transcript_length: transcript.length },
    });

    return NextResponse.json({ transcript });
  } catch (e) {
    const message = e instanceof Error ? e.message : "transcribe_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
