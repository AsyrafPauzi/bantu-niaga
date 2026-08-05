import "server-only";

import { decrementProductStock } from "@/lib/sales/stock";
import type { HandlerContext } from "@/lib/events/dispatcher";
import type { StockDecrementPayload } from "@/lib/events/payloads";

export async function handleStockDecrement(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as StockDecrementPayload;
  if (payload.lines.length === 0) return;
  await decrementProductStock(ctx.supabase, payload.business_id, payload.lines);
}
