import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { executeMarketingAssistantTool } from "@/lib/ai/marketing-assistant-tools";
import { executeSalesAssistantTool } from "@/lib/ai/sales-assistant-tools";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";

export type BoardroomPendingAction = {
  agent: "marketing" | "sales";
  tool: string;
  args: Record<string, unknown>;
  summary: string;
};

const MARKETING_TOOLS = new Set([
  "create_coupon",
  "create_broadcast_draft",
  "create_content_draft",
]);

const SALES_TOOLS = new Set(["create_lead", "add_lead_note"]);

/** Owner confirmed create drafts proposed in the last synthesis. */
export function isBoardroomCreateConfirm(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length > 120) return false;
  return /^(yes|y|ok|okay|confirm|confirmed|buat|ya|setuju|proceed|do it|go ahead)([.! ]|$)/i.test(
    t,
  ) || /^(ya\s+buat|buat\s+sekarang|yes\s+please|confirm\s+create)\b/i.test(t);
}

/**
 * Extract draft actions from the meeting turn (Maya / Sufi only).
 * Returns [] if nothing concrete enough to create safely.
 */
export async function extractBoardroomPendingActions(opts: {
  invited: BoardroomAgentId[];
  userMessage: string;
  synthContent: string;
  agentReplies: Array<{ agentId: BoardroomAgentId; content: string }>;
  model: string;
}): Promise<BoardroomPendingAction[]> {
  const canMarketing = opts.invited.includes("marketing");
  const canSales = opts.invited.includes("sales");
  if (!canMarketing && !canSales) return [];

  const createHint =
    /\b(create|draft|buat|cipta|coupon|broadcast|lead|note|content)\b/i.test(
      `${opts.userMessage}\n${opts.synthContent}`,
    );
  if (!createHint) return [];

  const staff = opts.agentReplies
    .map((r) => `${r.agentId}: ${r.content}`)
    .join("\n\n");

  try {
    const completion = await openaiChat<ChatCompletionResponse>({
      model: opts.model,
      temperature: 0,
      max_tokens: 500,
      includeBriefing: false,
      messages: [
        {
          role: "system",
          content: `Extract ZERO or more draft create actions the owner clearly asked for.
Only marketing tools: create_coupon, create_broadcast_draft, create_content_draft.
Only sales tools: create_lead, add_lead_note.
Hana/hr: never.
If details are incomplete, return empty actions.
Return ONLY JSON:
{"actions":[{"agent":"marketing"|"sales","tool":"...","args":{},"summary":"short"}]}

Allowed agents present: marketing=${canMarketing} sales=${canSales}`,
        },
        {
          role: "user",
          content: `Owner:\n${opts.userMessage}\n\nStaff:\n${staff}\n\nSynthesis:\n${opts.synthContent}`,
        },
      ],
    });

    const text = extractChatAssistantText(completion);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as {
      actions?: BoardroomPendingAction[];
    };

    return (parsed.actions ?? [])
      .filter((a) => {
        if (a.agent === "marketing") {
          return canMarketing && MARKETING_TOOLS.has(a.tool);
        }
        if (a.agent === "sales") {
          return canSales && SALES_TOOLS.has(a.tool);
        }
        return false;
      })
      .slice(0, 5)
      .map((a) => ({
        agent: a.agent,
        tool: a.tool,
        args: a.args && typeof a.args === "object" ? a.args : {},
        summary: String(a.summary ?? a.tool).slice(0, 200),
      }));
  } catch {
    return [];
  }
}

export async function executeBoardroomPendingActions(opts: {
  ctx: AgentContext;
  actions: BoardroomPendingAction[];
}): Promise<string[]> {
  const lines: string[] = [];

  for (const action of opts.actions) {
    try {
      if (action.agent === "marketing") {
        if (!MARKETING_TOOLS.has(action.tool)) {
          lines.push(`Skipped ${action.tool} (not allowed).`);
          continue;
        }
        const result = await executeMarketingAssistantTool(
          opts.ctx,
          action.tool,
          action.args,
        );
        if (result.ok) {
          lines.push(
            `Maya: ${action.summary}${result.href ? ` → ${result.href}` : ""}`,
          );
        } else {
          lines.push(
            `Maya could not create (${action.tool}): ${result.message ?? "failed"}`,
          );
        }
        continue;
      }

      if (action.agent === "sales") {
        if (!SALES_TOOLS.has(action.tool)) {
          lines.push(`Skipped ${action.tool} (not allowed).`);
          continue;
        }
        const result = await executeSalesAssistantTool(
          opts.ctx,
          action.tool,
          action.args,
        );
        if (result.ok) {
          const href =
            typeof result.href === "string" ? ` → ${result.href}` : "";
          lines.push(`Sufi: ${action.summary}${href}`);
        } else {
          lines.push(
            `Sufi could not create (${action.tool}): ${String(result.error ?? "failed")}`,
          );
        }
      }
    } catch {
      lines.push(`Failed: ${action.summary}`);
    }
  }

  return lines;
}
