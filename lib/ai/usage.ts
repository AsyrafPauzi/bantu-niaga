import "server-only";

import type { CreditMode } from "@/lib/ai/credits";
import { HR_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiTriggerType =
  | "CHAT"
  | "ACTION"
  | "DAILY_NOTICE";

export async function recordAiUsage(opts: {
  businessId: string;
  triggerType: AiTriggerType;
  creditsCharged: number;
  mode: CreditMode;
  tokensIn?: number;
  tokensOut?: number;
  costMyrEstimated?: number;
  metadata?: Record<string, unknown>;
  agentSlug?: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_ai_usage", {
    p_business_id: opts.businessId,
    p_agent_slug: opts.agentSlug ?? HR_AGENT_SLUG,
    p_trigger_type: opts.triggerType,
    p_credits_charged: opts.creditsCharged,
    p_mode: opts.mode,
    p_tokens_in: opts.tokensIn ?? 0,
    p_tokens_out: opts.tokensOut ?? 0,
    p_cost_myr_estimated: opts.costMyrEstimated ?? 0,
    p_metadata: opts.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}
