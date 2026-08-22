-- ============================================================
-- Partial invoice payments + customer link on transactions
-- ============================================================

-- 1. Add amount_paid_myr to track total collected against an invoice.
--    Default 0 so existing paid invoices can be back-filled below.
alter table public.finance_invoices
  add column if not exists amount_paid_myr numeric(12,2) not null default 0
    check (amount_paid_myr >= 0);

-- Back-fill: existing paid invoices have amount_paid_myr = total_myr
update public.finance_invoices
  set amount_paid_myr = total_myr
  where status = 'paid' and amount_paid_myr = 0;

-- 2. Add 'partially_paid' to the allowed status values.
--    The existing check constraint must be dropped and recreated.
alter table public.finance_invoices
  drop constraint if exists finance_invoices_status_check;

alter table public.finance_invoices
  add constraint finance_invoices_status_check
    check (status in ('draft', 'sent', 'paid', 'void', 'partially_paid'));

-- 3. Add customer_id to finance_transactions so manual income entries
--    can be linked to a customer record (shows in statement of account).
alter table public.finance_transactions
  add column if not exists customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists finance_txn_customer_id_idx
  on public.finance_transactions (business_id, customer_id)
  where deleted_at is null and customer_id is not null;

comment on column public.finance_transactions.customer_id is
  'Optional link to the canonical customers table. Set for manual income/expense entries and auto-recorded booking/order income.';
