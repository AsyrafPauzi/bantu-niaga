import "server-only";

import { createLeadFromOrder } from "@/lib/operations/order-lead";
import type { HandlerContext } from "@/lib/events/dispatcher";
import type { OrderCreatedPayload } from "@/lib/events/payloads";

export async function handleOrderCreated(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as OrderCreatedPayload;
  if (!payload.can_leads) return;
  if (!payload.customer_phone?.trim()) return;
  await createLeadFromOrder(ctx.supabase, {
    businessId: payload.business_id,
    orderId: payload.order_id,
    userId: payload.user_id,
    canLeads: true,
  });
}
