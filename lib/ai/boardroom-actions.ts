import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import {
  extractChatAssistantText,
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { executeHrAssistantTool } from "@/lib/ai/hr-assistant-tools";
import { executeMarketingAssistantTool } from "@/lib/ai/marketing-assistant-tools";
import { executeSalesAssistantTool } from "@/lib/ai/sales-assistant-tools";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import type { BoardroomPriorityAction } from "@/lib/ai/boardroom-output-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BoardroomPendingAction = {
  id?: string;
  agent: "marketing" | "sales" | "hr" | "finance" | "operations" | "admin";
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  label?: string;
  link_href?: string;
  rationale?: string;
  requires_ai_draft?: boolean;
};

const MARKETING_TOOLS = new Set([
  "create_coupon",
  "create_broadcast_draft",
  "create_content_draft",
]);

const SALES_TOOLS = new Set(["create_lead", "add_lead_note"]);

const HR_TOOLS = new Set([
  "create_leave_record",
  "update_leave_status",
  "complete_onboarding_item",
]);

const FINANCE_TOOLS = new Set(["log_expense", "log_income"]);

const OPERATIONS_TOOLS = new Set(["create_order", "adjust_stock"]);

/** Map chair priority_actions to pending actions (navigation + tool drafts). */
export function mapPriorityActionsToPending(
  actions: BoardroomPriorityAction[],
): BoardroomPendingAction[] {
  return actions.slice(0, 4).map((a) => {
    if (a.link_href) {
      return {
        id: a.id,
        agent: a.owner_agent,
        tool: "navigate",
        args: { href: a.link_href },
        summary: a.label,
        label: a.label,
        link_href: a.link_href,
        rationale: a.rationale,
        requires_ai_draft: false,
      };
    }

    const toolByAgent: Partial<Record<BoardroomAgentId, string>> = {
      marketing: "create_coupon",
      sales: "add_lead_note",
      hr: "create_leave_record",
      finance: "log_expense",
      operations: "create_order",
    };

    return {
      id: a.id,
      agent: a.owner_agent,
      tool: toolByAgent[a.owner_agent] ?? "navigate",
      args: {},
      summary: a.label,
      label: a.label,
      rationale: a.rationale,
      requires_ai_draft: a.owner_agent === "marketing",
    };
  });
}

export function filterPendingActionsByIds(
  actions: BoardroomPendingAction[],
  ids: string[],
): BoardroomPendingAction[] {
  const set = new Set(ids);
  return actions.filter((a) => a.id && set.has(a.id));
}

export function isBoardroomCreateConfirm(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length > 120) return false;
  return /^(yes|y|ok|okay|confirm|confirmed|buat|ya|setuju|proceed|do it|go ahead)([.! ]|$)/i.test(
    t,
  ) || /^(ya\s+buat|buat\s+sekarang|yes\s+please|confirm\s+create)\b/i.test(t);
}

/**
 * Extract draft actions from the meeting turn (Maya / Sufi / Hana).
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
  const canHr = opts.invited.includes("hr");
  const canFinance = opts.invited.includes("finance");
  const canOperations = opts.invited.includes("operations");

  if (!canMarketing && !canSales && !canHr && !canFinance && !canOperations) {
    return [];
  }

  const createHint =
    /\b(create|draft|buat|cipta|coupon|broadcast|lead|note|content|leave|cuti|approve|lulus|onboarding|expense|perbelanjaan|income|pendapatan|order|pesanan|stock|stok)\b/i.test(
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
      max_tokens: 600,
      includeBriefing: false,
      messages: [
        {
          role: "system",
          content: `Extract ZERO or more draft create actions the owner clearly asked for.
Marketing tools: create_coupon, create_broadcast_draft, create_content_draft.
Sales tools: create_lead, add_lead_note.
HR tools (Hana): create_leave_record, update_leave_status, complete_onboarding_item — only when dates, employee, and decision are explicit.
Finance tools (Fayza): log_expense (args: amount_myr, category, description, date YYYY-MM-DD), log_income (args: amount_myr, category, description, date YYYY-MM-DD) — only when amount and category are explicit.
Operations tools (Aiman): create_order (args: customer_name, notes, due_at ISO), adjust_stock (args: product_id or sku, quantity) — only when all required details are explicit.
If details are incomplete, return empty actions.
Return ONLY JSON:
{"actions":[{"agent":"marketing"|"sales"|"hr"|"finance"|"operations","tool":"...","args":{},"summary":"short"}]}

Allowed: marketing=${canMarketing} sales=${canSales} hr=${canHr} finance=${canFinance} operations=${canOperations}`,
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
        if (a.agent === "hr") {
          return canHr && HR_TOOLS.has(a.tool);
        }
        if (a.agent === "finance") {
          return canFinance && FINANCE_TOOLS.has(a.tool);
        }
        if (a.agent === "operations") {
          return canOperations && OPERATIONS_TOOLS.has(a.tool);
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
      if (action.tool === "navigate" && action.link_href) {
        lines.push(`${action.label ?? action.summary} → ${action.link_href}`);
        continue;
      }

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
          const href =
            typeof result === "object" &&
            result !== null &&
            "href" in result &&
            typeof result.href === "string"
              ? ` → ${result.href}`
              : "";
          lines.push(`Maya: ${action.summary}${href}`);
        } else {
          const message =
            typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof result.message === "string"
              ? result.message
              : "failed";
          lines.push(
            `Maya could not create (${action.tool}): ${message}`,
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
        continue;
      }

      if (action.agent === "hr") {
        if (!HR_TOOLS.has(action.tool)) {
          lines.push(`Skipped ${action.tool} (not allowed).`);
          continue;
        }
        const result = await executeHrAssistantTool(
          opts.ctx,
          action.tool,
          action.args,
        );
        if (result.ok) {
          const href =
            typeof result.href === "string" ? ` → ${result.href}` : "";
          const warn =
            result.warnings?.length ? ` (${result.warnings.join(" ")})` : "";
          lines.push(`Hana: ${action.summary}${warn}${href}`);
        } else {
          lines.push(
            `Hana could not complete (${action.tool}): ${result.message}`,
          );
        }
        continue;
      }

      if (action.agent === "finance") {
        if (!FINANCE_TOOLS.has(action.tool)) {
          lines.push(`Skipped ${action.tool} (not allowed).`);
          continue;
        }
        const finResult = await executeBoardroomFinanceTool(
          opts.ctx,
          action.tool,
          action.args,
        );
        if (finResult.ok) {
          const href =
            typeof finResult.href === "string" ? ` → ${finResult.href}` : "";
          lines.push(`Fayza: ${action.summary}${href}`);
        } else {
          lines.push(
            `Fayza could not complete (${action.tool}): ${finResult.message}`,
          );
        }
        continue;
      }

      if (action.agent === "operations") {
        if (!OPERATIONS_TOOLS.has(action.tool)) {
          lines.push(`Skipped ${action.tool} (not allowed).`);
          continue;
        }
        const opsResult = await executeBoardroomOperationsTool(
          opts.ctx,
          action.tool,
          action.args,
        );
        if (opsResult.ok) {
          const href =
            typeof opsResult.href === "string" ? ` → ${opsResult.href}` : "";
          lines.push(`Aiman: ${action.summary}${href}`);
        } else {
          lines.push(
            `Aiman could not complete (${action.tool}): ${opsResult.message}`,
          );
        }
        continue;
      }
    } catch {
      lines.push(`Failed: ${action.summary}`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Finance boardroom tool executor
// ---------------------------------------------------------------------------

type BoardroomToolResult =
  | { ok: true; href?: string }
  | { ok: false; message: string };

async function executeBoardroomFinanceTool(
  ctx: AgentContext,
  tool: string,
  args: Record<string, unknown>,
): Promise<BoardroomToolResult> {
  const amountRaw = args.amount_myr;
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "A valid positive amount_myr is required." };
  }

  const category =
    typeof args.category === "string" && args.category.trim()
      ? args.category.trim().slice(0, 80)
      : null;
  const description =
    typeof args.description === "string" && args.description.trim()
      ? args.description.trim().slice(0, 300)
      : null;

  const dateRaw = typeof args.date === "string" ? args.date.trim() : null;
  const txnDate =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? dateRaw
      : new Date().toISOString().slice(0, 10);

  const kind = tool === "log_income" ? "income" : "expense";
  const href = kind === "expense" ? "/finance/expenses" : "/finance/income";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("finance_transactions").insert({
    business_id: ctx.businessId,
    kind,
    amount_myr: amount,
    category: category ?? undefined,
    description: description ?? undefined,
    txn_date: txnDate,
    created_by: ctx.userId,
  });

  if (error) {
    return { ok: false, message: "Could not log transaction. Try from Finance." };
  }

  return { ok: true, href };
}

// ---------------------------------------------------------------------------
// Operations boardroom tool executor
// ---------------------------------------------------------------------------

async function executeBoardroomOperationsTool(
  ctx: AgentContext,
  tool: string,
  args: Record<string, unknown>,
): Promise<BoardroomToolResult> {
  const supabase = await createSupabaseServerClient();

  if (tool === "create_order") {
    const customerName =
      typeof args.customer_name === "string" && args.customer_name.trim()
        ? args.customer_name.trim().slice(0, 200)
        : null;
    const notes =
      typeof args.notes === "string" && args.notes.trim()
        ? args.notes.trim().slice(0, 1000)
        : null;
    const dueAtRaw = typeof args.due_at === "string" ? args.due_at.trim() : null;
    const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
    const dueAtIso =
      dueAt && !Number.isNaN(dueAt.valueOf()) ? dueAt.toISOString() : null;

    const { error } = await supabase.from("operations_orders").insert({
      business_id: ctx.businessId,
      customer_name: customerName ?? undefined,
      notes: notes ?? undefined,
      due_at: dueAtIso ?? undefined,
      status: "todo",
      created_by: ctx.userId,
    });

    if (error) {
      return {
        ok: false,
        message: "Could not create order. Try from Operations.",
      };
    }

    return { ok: true, href: "/operations/orders" };
  }

  if (tool === "adjust_stock") {
    const quantityRaw = args.quantity;
    const quantity =
      typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
    if (!Number.isFinite(quantity)) {
      return { ok: false, message: "A valid quantity is required." };
    }

    const productId =
      typeof args.product_id === "string" && args.product_id.trim()
        ? args.product_id.trim()
        : null;
    const sku =
      typeof args.sku === "string" && args.sku.trim()
        ? args.sku.trim()
        : null;

    if (!productId && !sku) {
      return { ok: false, message: "Provide product_id or sku to adjust stock." };
    }

    let updateQuery = supabase
      .from("operations_products")
      .update({ stock_quantity: quantity })
      .eq("business_id", ctx.businessId);

    if (productId) {
      updateQuery = updateQuery.eq("id", productId);
    } else {
      updateQuery = updateQuery.eq("sku", sku!);
    }

    const { error } = await updateQuery;

    if (error) {
      return {
        ok: false,
        message: "Could not adjust stock. Try from Operations.",
      };
    }

    return { ok: true, href: "/operations/products" };
  }

  return { ok: false, message: "Unknown operations tool." };
}
