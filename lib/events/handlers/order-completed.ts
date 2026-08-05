import "server-only";

import { recordExpenseFromOrder } from "@/lib/operations/order-expense";
import type { HandlerContext } from "@/lib/events/dispatcher";
import type { OrderCompletedPayload } from "@/lib/events/payloads";

export async function handleOrderCompleted(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as OrderCompletedPayload;
  await recordExpenseFromOrder(ctx.supabase, {
    businessId: payload.business_id,
    orderId: payload.order_id,
    userId: payload.user_id,
    canFinance: payload.can_finance,
  });
}
