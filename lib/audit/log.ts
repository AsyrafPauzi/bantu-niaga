import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogInput {
  businessId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget audit row for tenant mutations. Never throws to callers.
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  input: AuditLogInput,
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    business_id: input.businessId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    diff: input.diff ?? null,
  });

  if (error) {
    console.error("audit_log.insert_failed", {
      action: input.action,
      message: error.message,
    });
  }
}
