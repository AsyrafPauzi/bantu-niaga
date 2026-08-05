import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type NotificationPillar =
  | "admin"
  | "finance"
  | "operations"
  | "sales"
  | "marketing"
  | "hr"
  | "ai";

export interface PostNotificationInput {
  businessId: string;
  pillar?: NotificationPillar;
  eventType: string;
  message: string;
  meta?: Record<string, unknown>;
}

export async function postBusinessNotification(
  input: PostNotificationInput,
): Promise<void> {
  const message = input.message.trim();
  if (!message) return;

  const svc = createServiceRoleClient();
  const { error } = await svc.from("business_notifications").insert({
    business_id: input.businessId,
    pillar: input.pillar ?? "admin",
    event_type: input.eventType.slice(0, 80),
    message: message.slice(0, 500),
    meta: input.meta ?? {},
  });

  if (error) {
    console.error("business_notification.insert_failed", {
      businessId: input.businessId,
      eventType: input.eventType,
      error: error.message,
    });
  }
}
