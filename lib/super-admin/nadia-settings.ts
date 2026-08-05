import { z } from "zod";
import type { NadiaReplyMode } from "@/lib/super-admin/platform-agents-catalog";

export const nadiaSettingsSchema = z
  .object({
    reply_mode: z.enum(["text_only", "voice_only", "text_and_voice"]),
    voice_auto_play: z.boolean().optional(),
  })
  .strict();

export type NadiaSettings = z.infer<typeof nadiaSettingsSchema>;

export const DEFAULT_NADIA_SETTINGS: NadiaSettings = {
  reply_mode: "text_and_voice",
  voice_auto_play: true,
};

export function parseNadiaSettings(raw: unknown): NadiaSettings {
  const parsed = nadiaSettingsSchema.safeParse(raw);
  if (parsed.success) {
    return {
      reply_mode: parsed.data.reply_mode,
      voice_auto_play: parsed.data.voice_auto_play ?? true,
    };
  }
  return { ...DEFAULT_NADIA_SETTINGS };
}

export function includesVoiceOutput(mode: NadiaReplyMode): boolean {
  return mode === "voice_only" || mode === "text_and_voice";
}

export function includesTextOutput(mode: NadiaReplyMode): boolean {
  return mode === "text_only" || mode === "text_and_voice";
}

/** Rough per-query cost (MYR) at ILMU list pricing. */
export function estimateNadiaQueryCostMyr(opts: {
  replyMode: NadiaReplyMode;
  asrSeconds?: number;
  tokensIn?: number;
  tokensOut?: number;
  ttsChars?: number;
}): number {
  const asr =
    (opts.asrSeconds ?? (opts.replyMode !== "text_only" ? 10 : 0)) * 0.0002;
  const tokensIn = opts.tokensIn ?? 2500;
  const tokensOut = opts.tokensOut ?? 350;
  const llm = (tokensIn * 4) / 1_000_000 + (tokensOut * 16) / 1_000_000;
  const ttsChars =
    opts.ttsChars ??
    (includesVoiceOutput(opts.replyMode) ? 550 : 0);
  const tts = (ttsChars * 0.08) / 1000;
  return Math.round((asr + llm + tts) * 10000) / 10000;
}

export function costHintForMode(mode: NadiaReplyMode): string {
  const myr = estimateNadiaQueryCostMyr({ replyMode: mode });
  return `~RM ${myr.toFixed(3)} per typical query`;
}
