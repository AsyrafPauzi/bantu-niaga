import "server-only";

import {
  buildFreeClarifierReply,
  isClarifyingOnlyReply,
} from "@/lib/ai/assistant-clarifier";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import type { PillarSnapshot } from "@/lib/ai/context/types";

/**
 * Free smart clarifier for Sufi — one short model call, warm tone.
 * Falls back to template on any failure.
 */
export async function buildSmartSalesClarifier(opts: {
  displayName: string;
  userMessage: string;
  snapshot: PillarSnapshot;
  model: string;
}): Promise<{ reply: string; usedModel: boolean }> {
  const facts = [
    opts.snapshot.headline,
    ...opts.snapshot.attention.slice(0, 3).map((a) => a.label),
    opts.snapshot.notes ?? "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 400);

  try {
    const completion = await openaiChat<ChatCompletionResponse>({
      model: opts.model,
      temperature: 0.5,
      max_tokens: 220,
      includeBriefing: false,
      messages: [
        {
          role: "system",
          content: `You are ${opts.displayName}, a warm Malaysian SME sales colleague (not a robot).
Ask 2–3 short clarifying questions before planning. No plan, no tools, no invented numbers.
Use Bahasa Malaysia if the user wrote in BM, else English.
Mention at most one real fact from FACTS if useful.
End by inviting them to reply in one message or say "you decide".
Add a one-line note that these questions are free (no credits).
FACTS: ${facts || "No sales data yet."}`,
        },
        { role: "user", content: opts.userMessage },
      ],
    });
    const reply = extractChatAssistantText(completion).trim();
    if (reply && isClarifyingOnlyReply(reply)) {
      return { reply, usedModel: true };
    }
    if (reply && (reply.match(/\?/g) ?? []).length >= 2) {
      return { reply, usedModel: true };
    }
  } catch {
    // fall through
  }

  return {
    reply: buildFreeClarifierReply("sales", opts.displayName, opts.userMessage),
    usedModel: false,
  };
}
