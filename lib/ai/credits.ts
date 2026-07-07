import "server-only";

import type { AgentContext } from "@/lib/ai/context/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreditMode = "fast";

export interface SpendCreditsResult {
  charged: number;
  mode: CreditMode;
  balance: number;
}

export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits" as const;

  constructor(message = "insufficient_credits") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export function isInsufficientCreditsError(
  error: unknown,
): error is InsufficientCreditsError {
  if (error instanceof InsufficientCreditsError) return true;
  return (
    error instanceof Error &&
    error.message.includes("insufficient_credits")
  );
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
    p_allow_slow: opts.allowSlow ?? false,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(error.message);
  }

  const row = data as {
    charged: number;
    mode: CreditMode;
    new_balance: number;
  };

  return {
    charged: row.charged,
    mode: "fast",
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
