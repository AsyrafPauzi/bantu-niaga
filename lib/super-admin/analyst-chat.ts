import "server-only";

import { loadPublishedAgentScope } from "@/lib/ai/agent-scope-runtime";
import { buildVoiceScript, ilmuSynthesizeSpeech } from "@/lib/ai/ilmu-speech";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { formatAssistantReply } from "@/lib/ai/assistant-reply";
import { logger } from "@/lib/logger";
import {
  buildPlatformAnalystSnapshot,
  snapshotToPromptJson,
} from "@/lib/super-admin/analyst-context";
import { loadNadiaSettings } from "@/lib/super-admin/nadia-load";
import {
  estimateNadiaQueryCostMyr,
  includesTextOutput,
  includesVoiceOutput,
} from "@/lib/super-admin/nadia-settings";
import { NADIA_OUTPUT_FORMAT } from "@/lib/super-admin/nadia-output-format";
import { stripMarkdownForSpeech } from "@/lib/super-admin/nadia-speech-text";

const NADIA_MODEL = "ilmu-v3.1";

export interface NadiaChatResult {
  reply: string;
  voiceScript: string | null;
  audioBase64: string | null;
  audioContentType: string | null;
  replyMode: string;
  showText: boolean;
  showVoice: boolean;
  voiceAutoPlay: boolean;
  costMyrEstimated: number;
  tokensIn: number;
  tokensOut: number;
  voiceGenerated: boolean;
  ttsError: string | null;
}

export async function runNadiaChat(question: string): Promise<NadiaChatResult> {
  const settings = await loadNadiaSettings();
  const [snapshot, scope] = await Promise.all([
    buildPlatformAnalystSnapshot(),
    loadPublishedAgentScope("nadia"),
  ]);

  const systemPrompt =
    scope?.systemPrompt ??
    "You are Nadia, a read-only platform analyst. Answer only from the snapshot JSON.";

  const snapshotJson = snapshotToPromptJson(snapshot);
  const completion = await openaiChat<ChatCompletionResponse>({
    model: NADIA_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${NADIA_OUTPUT_FORMAT}\n\nPlatform snapshot (generated ${snapshot.generatedAt}):\n${snapshotJson}`,
      },
      { role: "user", content: question.trim() },
    ],
  });

  const reply = formatAssistantReply(extractChatAssistantText(completion));
  const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
    .usage;
  const tokensIn = usage?.prompt_tokens ?? 2500;
  const tokensOut = usage?.completion_tokens ?? reply.length / 4;

  const showText = includesTextOutput(settings.reply_mode);
  const showVoice = includesVoiceOutput(settings.reply_mode);
  let voiceScript: string | null = null;
  let audioBase64: string | null = null;
  let audioContentType: string | null = null;
  let voiceGenerated = false;
  let ttsError: string | null = null;

  if (showVoice) {
    voiceScript = buildVoiceScript(stripMarkdownForSpeech(reply));
    try {
      const speech = await ilmuSynthesizeSpeech({ text: voiceScript });
      audioBase64 = Buffer.from(speech.audio).toString("base64");
      audioContentType = speech.contentType;
      voiceGenerated = true;
      logger.info("nadia.tts.ok", {
        chars: voiceScript.length,
        contentType: speech.contentType,
      });
    } catch (e) {
      ttsError = e instanceof Error ? e.message : "tts_failed";
      logger.error("nadia.tts.failed", { error: ttsError });
      voiceScript = null;
    }
  }

  const costMyrEstimated = estimateNadiaQueryCostMyr({
    replyMode: settings.reply_mode,
    tokensIn,
    tokensOut,
    ttsChars: voiceScript?.length ?? 0,
  });

  return {
    reply,
    voiceScript,
    audioBase64,
    audioContentType,
    replyMode: settings.reply_mode,
    showText,
    showVoice,
    voiceAutoPlay: settings.voice_auto_play ?? true,
    costMyrEstimated,
    tokensIn,
    tokensOut,
    voiceGenerated,
    ttsError,
  };
}
