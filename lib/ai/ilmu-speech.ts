import "server-only";

import { getOpenAIConfig } from "@/lib/ai/openai";

const ASR_MODEL = "ilmu-asr-v4.2";
const TTS_MODEL = "ilmu-tts-v2";
/** ILMU TTS v2 voices: voice_1, voice_2, voice_3 */
const TTS_DEFAULT_VOICE = "voice_1";

export async function ilmuTranscribeAudio(opts: {
  audio: Blob | Buffer;
  filename?: string;
  mimeType?: string;
}): Promise<{ transcript: string; durationSeconds?: number }> {
  const cfg = await getOpenAIConfig();
  const base = cfg.baseUrl.replace(/\/$/, "");

  const form = new FormData();
  const blob =
    opts.audio instanceof Blob
      ? opts.audio
      : new Blob([new Uint8Array(opts.audio)], {
          type: opts.mimeType ?? "audio/webm",
        });
  form.append("file", blob, opts.filename ?? "audio.webm");
  form.append("model", ASR_MODEL);

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ASR HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text?: string };
  const transcript = data.text?.trim() ?? "";
  if (!transcript) {
    throw new Error("ASR returned empty transcript");
  }
  return { transcript };
}

export async function ilmuSynthesizeSpeech(opts: {
  text: string;
  voice?: string;
}): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const cfg = await getOpenAIConfig();
  const base = cfg.baseUrl.replace(/\/$/, "");
  const input = opts.text.trim();
  if (!input) {
    throw new Error("TTS input is empty");
  }

  const res = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input,
      voice: opts.voice ?? TTS_DEFAULT_VOICE,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTS HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const audio = await res.arrayBuffer();
  return { audio, contentType };
}

/** Short summary for TTS to reduce per-character cost. */
export function buildVoiceScript(fullReply: string, maxChars = 320): string {
  const trimmed = fullReply.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [trimmed];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > maxChars) break;
    out += s;
  }
  return out.trim() || trimmed.slice(0, maxChars);
}
