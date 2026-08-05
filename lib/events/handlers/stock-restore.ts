import "server-only";

import { restoreProductStock } from "@/lib/sales/stock";
import type { HandlerContext } from "@/lib/events/dispatcher";
import type { StockRestorePayload } from "@/lib/events/payloads";

export async function handleStockRestore(ctx: HandlerContext): Promise<void> {
  const payload = ctx.payload as unknown as StockRestorePayload;
  if (payload.lines.length === 0) return;
  await restoreProductStock(ctx.supabase, payload.business_id, payload.lines);
}
