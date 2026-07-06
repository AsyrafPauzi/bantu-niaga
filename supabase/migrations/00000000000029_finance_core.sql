-- ============================================================================
-- Bantu Niaga — Finance pillar · Cash flow + customer invoices
-- ============================================================================
-- Separate from public.invoices (subscription/billing in settings M1).
--
--   finance_transactions — simple income / expense log (no double-entry)
--   finance_invoices     — customer invoices with secure share hash
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- finance_invoices
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.finance_invoices (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  number          text not null,
  share_hash      text not null,
  customer_name   text not null check (char_length(trim(customer_name)) > 0),
  customer_email  text,
  customer_phone  text,
  description     text,
  amount_myr      numeric(12, 2) not null check (amount_myr >= 0),
  tax_myr         numeric(12, 2) not null default 0 check (tax_myr >= 0),
  total_myr       numeric(12, 2) not null check (total_myr >= 0),
  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'paid', 'void')),
  due_date        date,
  notes           text,
  paid_at         timestamptz,
  sent_at         timestamptz,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint finance_invoices_number_per_business unique (business_id, number),
  constraint finance_invoices_hash_per_business unique (business_id, share_hash),
  constraint finance_invoices_share_hash_shape
    check (share_hash ~ '^[a-z0-9]{8}$')
);

comment on table public.finance_invoices is
  'Customer-facing invoices — distinct from subscription billing public.invoices.';

create index if not exists finance_invoices_business_recent_idx
  on public.finance_invoices (business_id, created_at desc)
  where deleted_at is null;

create index if not exists finance_invoices_business_status_idx
  on public.finance_invoices (business_id, status)
  where deleted_at is null;

drop trigger if exists finance_invoices_set_updated_at on public.finance_invoices;
create trigger finance_invoices_set_updated_at
  before update on public.finance_invoices
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- finance_transactions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.finance_transactions (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  kind                text not null check (kind in ('income', 'expense')),
  amount_myr          numeric(12, 2) not null check (amount_myr > 0),
  category            text,
  description         text not null check (char_length(trim(description)) > 0),
  counterparty        text,
  payment_method      text
                      check (payment_method is null or payment_method in (
                        'cash', 'duitnow', 'bank', 'card', 'other'
                      )),
  txn_date            date not null default current_date,
  finance_invoice_id  uuid references public.finance_invoices(id) on delete set null,
  created_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.finance_transactions is
  'Simple income / expense cash-flow entries — one row per in or out.';

create index if not exists finance_txn_business_date_idx
  on public.finance_transactions (business_id, txn_date desc)
  where deleted_at is null;

create index if not exists finance_txn_business_kind_idx
  on public.finance_transactions (business_id, kind, txn_date desc)
  where deleted_at is null;

drop trigger if exists finance_transactions_set_updated_at on public.finance_transactions;
create trigger finance_transactions_set_updated_at
  before update on public.finance_transactions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — finance_invoices
-- ─────────────────────────────────────────────────────────────────────────
alter table public.finance_invoices enable row level security;

drop policy if exists "finance_invoices_select" on public.finance_invoices;
create policy "finance_invoices_select" on public.finance_invoices
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "finance_invoices_insert" on public.finance_invoices;
create policy "finance_invoices_insert" on public.finance_invoices
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists "finance_invoices_update" on public.finance_invoices;
create policy "finance_invoices_update" on public.finance_invoices
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — finance_transactions
-- ─────────────────────────────────────────────────────────────────────────
alter table public.finance_transactions enable row level security;

drop policy if exists "finance_transactions_select" on public.finance_transactions;
create policy "finance_transactions_select" on public.finance_transactions
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "finance_transactions_insert" on public.finance_transactions;
create policy "finance_transactions_insert" on public.finance_transactions
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists "finance_transactions_update" on public.finance_transactions;
create policy "finance_transactions_update" on public.finance_transactions
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );
