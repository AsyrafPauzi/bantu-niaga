import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function logNadiaAudit(opts: {
  adminUserId: string;
  adminEmail: string;
  action: string;
  diff: Record<string, unknown>;
}): Promise<void> {
  const svc = createServiceRoleClient();
  await svc.from("super_admin_audit").insert({
    admin_user_id: opts.adminUserId,
    admin_email: opts.adminEmail,
    action: opts.action,
    target_type: "nadia",
    target_id: "nadia",
    diff: opts.diff,
  });
}
