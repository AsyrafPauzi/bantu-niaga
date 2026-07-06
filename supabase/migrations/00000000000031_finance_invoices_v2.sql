-- ============================================================================
-- Bantu Niaga — Finance invoices v2 · customers link + line items
-- ============================================================================

-- Allow accountants to manage customers for invoicing (Finance pillar).
drop policy if exists "customers_insert_self_business" on public.customers;
create policy "customers_insert_self_business" on public.customers
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists "customers_update_self_business" on public.customers;
create policy "customers_update_self_business" on public.customers
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  )
  with check (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- finance_invoices — extra columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.finance_invoices
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists title text,
  add column if not exists invoice_date date not null default current_date,
  add column if not exists discount_myr numeric(12, 2) not null default 0
    check (discount_myr >= 0),
  add column if not exists discount_pct numeric(5, 2) not null default 0
    check (discount_pct >= 0 and discount_pct <= 100),
  add column if not exists shipping_myr numeric(12, 2) not null default 0
    check (shipping_myr >= 0),
  add column if not exists tax_pct numeric(5, 2) not null default 0
    check (tax_pct >= 0 and tax_pct <= 100);

create index if not exists finance_invoices_customer_idx
  on public.finance_invoices (business_id, customer_id)
  where deleted_at is null and customer_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- finance_invoice_items
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.finance_invoice_items (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  invoice_id      uuid not null references public.finance_invoices(id) on delete cascade,
  description     text not null check (char_length(trim(description)) > 0),
  unit_price      numeric(12, 2) not null check (unit_price >= 0),
  quantity        numeric(12, 3) not null default 1 check (quantity > 0),
  unit            text,
  taxable         boolean not null default false,
  sort_order      integer not null default 0,
  line_total_myr  numeric(12, 2) not null check (line_total_myr >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.finance_invoice_items is
  'Line items for customer finance_invoices.';

create index if not exists finance_invoice_items_invoice_idx
  on public.finance_invoice_items (invoice_id, sort_order);

drop trigger if exists finance_invoice_items_set_updated_at on public.finance_invoice_items;
create trigger finance_invoice_items_set_updated_at
  before update on public.finance_invoice_items
  for each row execute function public.set_updated_at();

alter table public.finance_invoice_items enable row level security;

drop policy if exists "finance_invoice_items_select" on public.finance_invoice_items;
create policy "finance_invoice_items_select" on public.finance_invoice_items
  for select using (business_id = public.current_business_id());

drop policy if exists "finance_invoice_items_insert" on public.finance_invoice_items;
create policy "finance_invoice_items_insert" on public.finance_invoice_items
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists "finance_invoice_items_update" on public.finance_invoice_items;
create policy "finance_invoice_items_update" on public.finance_invoice_items
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );

drop policy if exists "finance_invoice_items_delete" on public.finance_invoice_items;
create policy "finance_invoice_items_delete" on public.finance_invoice_items
  for delete using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'accountant')
  );
