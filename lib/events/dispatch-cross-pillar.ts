import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { emitAndDispatch } from "@/lib/events/dispatcher";
import "@/lib/events/register-handlers";
import type {
  LeaveStatusPayload,
  OrderCompletedPayload,
  OrderCreatedPayload,
} from "@/lib/events/payloads";

export async function dispatchLeaveStatus(opts: {
  supabase: SupabaseClient;
  payload: LeaveStatusPayload;
  userId: string;
}): Promise<void> {
  const eventName =
    opts.payload.status === "approved" ? "leave.approved" : "leave.rejected";
  await emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: eventName,
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.userId,
  });
}

export async function dispatchOrderCompleted(opts: {
  supabase: SupabaseClient;
  payload: OrderCompletedPayload;
}): Promise<void> {
  await emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "order.completed",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.payload.user_id,
  });
}

export async function dispatchOrderCreated(opts: {
  supabase: SupabaseClient;
  payload: OrderCreatedPayload;
}): Promise<void> {
  await emitAndDispatch({
    supabase: opts.supabase,
    businessId: opts.payload.business_id,
    name: "order.created",
    payload: opts.payload as unknown as Record<string, unknown>,
    userId: opts.payload.user_id,
  });
}
