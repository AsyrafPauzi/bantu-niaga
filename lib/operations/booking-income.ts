import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFinanceTransactionCreated } from "@/lib/finance/notify";

/**
 * Auto-record income when a booking is marked completed (idempotent).
 * Only creates a transaction if the booking has amount_myr > 0 and none exists yet.
 */
export async function recordIncomeFromBooking(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    bookingId: string;
    userId: string;
  },
): Promise<{ ok: boolean; reason?: string }> {
  const { data: booking, error: bookingErr } = await supabase
    .from("operations_bookings")
    .select("id, number, service_title, amount_myr, customer_name")
    .eq("business_id", opts.businessId)
    .eq("id", opts.bookingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (bookingErr || !booking) return { ok: false, reason: "not_found" };

  const amount = booking.amount_myr != null ? Number(booking.amount_myr) : 0;
  if (amount <= 0) return { ok: false, reason: "no_amount" };

  const { data: existing } = await supabase
    .from("finance_transactions")
    .select("id")
    .eq("business_id", opts.businessId)
    .eq("operations_booking_id", opts.bookingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return { ok: false, reason: "already_recorded" };

  const { data: txn, error: txnErr } = await supabase
    .from("finance_transactions")
    .insert({
      business_id: opts.businessId,
      kind: "income",
      amount_myr: amount,
      category: "booking_payment",
      description: `Booking ${booking.number as string}: ${booking.service_title as string}`,
      counterparty: booking.customer_name as string,
      payment_method: "other",
      txn_date: new Date().toISOString().slice(0, 10),
      operations_booking_id: opts.bookingId,
      created_by: opts.userId,
    })
    .select("id, description, amount_myr")
    .single();

  if (txnErr || !txn) return { ok: false, reason: "create_failed" };

  notifyFinanceTransactionCreated({
    businessId: opts.businessId,
    kind: "income",
    description: txn.description as string,
    amountMyr: Number(txn.amount_myr),
    txnId: txn.id as string,
  });

  return { ok: true };
}
