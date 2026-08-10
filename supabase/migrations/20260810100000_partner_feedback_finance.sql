-- Partner feedback Wave 1: invoice address snapshot + secure share links

alter table public.finance_invoices
  add column if not exists customer_address text
    check (customer_address is null or length(customer_address) <= 500);

comment on column public.finance_invoices.customer_address is
  'Snapshot of customer address at invoice creation/update.';

alter table public.finance_invoices
  add column if not exists share_issued_at timestamptz,
  add column if not exists share_expires_at timestamptz;

comment on column public.finance_invoices.share_issued_at is
  'When the current share_hash was issued (on send or refresh).';
comment on column public.finance_invoices.share_expires_at is
  'Public link expiry for unpaid sent invoices; null = no expiry.';

-- Allow longer unpredictable tokens (existing 8-char hashes remain valid)
alter table public.finance_invoices
  drop constraint if exists finance_invoices_share_hash_shape;

alter table public.finance_invoices
  add constraint finance_invoices_share_hash_shape
  check (share_hash ~ '^[a-z0-9]{8,64}$');

-- Backfill address from linked customers
update public.finance_invoices fi
set customer_address = c.address
from public.customers c
where fi.customer_id = c.id
  and fi.customer_address is null
  and c.address is not null
  and c.deleted_at is null;
