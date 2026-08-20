import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export type ActivationKind = "invoice" | "pos";

/** Best-effort: never fail the parent request if activation stamp fails. */
export async function touchActivation(
  supabase: SupabaseClient,
  businessId: string,
  kind: ActivationKind,
): Promise<void> {
  const { error } = await supabase.rpc("business_touch_activation", {
    p_business_id: businessId,
    p_kind: kind,
  });
  if (error) {
    logger.error("activation.touch.failed", {
      businessId,
      kind,
      error: error.message,
    });
  }
}
