import "server-only";

import { registerSyncHandler } from "@/lib/events/dispatcher";
import { handleInvoicePaid } from "@/lib/events/handlers/invoice-paid";
import { handleLeaveStatus } from "@/lib/events/handlers/leave-status";
import {
  handleCustomerOutboxAck,
  handleMarketingMetricEvent,
} from "@/lib/events/handlers/marketing-metric";
import { handleOrderCompleted } from "@/lib/events/handlers/order-completed";
import { handleOrderCreated } from "@/lib/events/handlers/order-created";
import { handleSaleCompleted } from "@/lib/events/handlers/sale-completed";
import { handleSaleVoided } from "@/lib/events/handlers/sale-voided";
import { handleStockDecrement } from "@/lib/events/handlers/stock-decrement";
import { handleStockRestore } from "@/lib/events/handlers/stock-restore";

let registered = false;

/** Register all synchronous cross-pillar handlers (idempotent). */
export function registerCrossPillarHandlers(): void {
  if (registered) return;
  registered = true;

  registerSyncHandler("sale.completed", async (ctx) => {
    await handleSaleCompleted({
      supabase: ctx.supabase,
      payload: ctx.payload as never,
      userId: ctx.userId ?? "",
    });
  });

  registerSyncHandler("sale.voided", async (ctx) => {
    await handleSaleVoided({
      supabase: ctx.supabase,
      payload: ctx.payload as never,
      userId: ctx.userId,
    });
  });

  registerSyncHandler("stock.decrement", handleStockDecrement);
  registerSyncHandler("stock.restore", handleStockRestore);
  registerSyncHandler("leave.approved", handleLeaveStatus);
  registerSyncHandler("leave.rejected", handleLeaveStatus);
  registerSyncHandler("order.completed", handleOrderCompleted);
  registerSyncHandler("order.created", handleOrderCreated);
  registerSyncHandler("invoice.paid", handleInvoicePaid);

  for (const name of [
    "invoice.paid",
    "order.delivered",
    "booking.completed",
    "lead.converted",
  ] as const) {
    registerSyncHandler(name, handleMarketingMetricEvent);
  }

  for (const name of [
    "customer.created",
    "customer.updated",
    "customer.deleted",
    "customer.merged",
    "customer.tag_changed",
  ] as const) {
    registerSyncHandler(name, handleCustomerOutboxAck);
  }
}

registerCrossPillarHandlers();
