-- Add operations_booking_id to finance_transactions so that
-- income auto-recorded from a completed booking can be traced back.
alter table public.finance_transactions
  add column if not exists operations_booking_id uuid
    references public.operations_bookings (id) on delete set null;

comment on column public.finance_transactions.operations_booking_id is
  'Set when this income row was auto-generated from a completed booking.';

create index if not exists finance_txn_booking_id_idx
  on public.finance_transactions (business_id, operations_booking_id)
  where deleted_at is null and operations_booking_id is not null;
