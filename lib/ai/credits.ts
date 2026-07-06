import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreditMode = "fast" | "slow";

export interface SpendCreditsResult {
  charged: number;
  mode: CreditMode;
  balance: number;
}

export async function spendCredits(
  ctx: AgentContext,
  opts: {
    amount: number;
    reason: string;
    allowSlow?: boolean;
  },
): Promise<SpendCreditsResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_spend_credits", {
    p_business_id: ctx.businessId,
    p_credits: opts.amount,
    p_reason: opts.reason,
    p_actor_user_id: ctx.userId,
    p_allow_slow: opts.allowSlow ?? true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = data as {
    charged: number;
    mode: CreditMode;
    new_balance: number;
  };

  return {
    charged: row.charged,
    mode: row.mode,
    balance: row.new_balance,
  };
}

export async function grantCredits(
  businessId: string,
  amount: number,
  reason: string,
  actorUserId?: string | null,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_grant_credits", {
    p_business_id: businessId,
    p_credits: amount,
    p_reason: reason,
    p_actor_user_id: actorUserId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data as number;
}

/** Slow mode delay — 15–20s with light jitter. */
export async function slowModeDelay(): Promise<void> {
  const ms = 15_000 + Math.floor(Math.random() * 5_000);
  await new Promise((resolve) => setTimeout(resolve, ms));
}
