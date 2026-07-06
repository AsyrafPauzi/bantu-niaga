-- ============================================================================
-- Bantu Niaga — Operations pillar · Orders + suppliers
-- ============================================================================
-- Simple job tracker (To do → In progress → Done) and vendor contact list.
-- Replaces sticky notes / WhatsApp threads for customer order tracking.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- operations_suppliers
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.operations_suppliers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null check (char_length(trim(name)) > 0),
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  payment_terms   text,
  notes           text,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.operations_suppliers is
  'Vendor / supplier contact directory for Operations.';

create index if not exists operations_suppliers_business_idx
  on public.operations_suppliers (business_id, name)
  where deleted_at is null;

drop trigger if exists operations_suppliers_set_updated_at on public.operations_suppliers;
create trigger operations_suppliers_set_updated_at
  before update on public.operations_suppliers
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- operations_orders
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.operations_orders (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  number          text not null,
  customer_name   text not null check (char_length(trim(customer_name)) > 0),
  customer_phone  text,
  title           text not null check (char_length(trim(title)) > 0),
  description     text,
  status          text not null default 'todo'
                  check (status in ('todo', 'in_progress', 'done')),
  due_date        date,
  amount_myr      numeric(12, 2) check (amount_myr is null or amount_myr >= 0),
  supplier_id     uuid references public.operations_suppliers(id) on delete set null,
  notes           text,
  completed_at    timestamptz,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint operations_orders_number_per_business unique (business_id, number)
);

comment on table public.operations_orders is
  'Customer order / job tracker — todo, in_progress, done pipeline.';

create index if not exists operations_orders_business_status_idx
  on public.operations_orders (business_id, status, created_at desc)
  where deleted_at is null;

create index if not exists operations_orders_business_due_idx
  on public.operations_orders (business_id, due_date)
  where deleted_at is null and status <> 'done';

drop trigger if exists operations_orders_set_updated_at on public.operations_orders;
create trigger operations_orders_set_updated_at
  before update on public.operations_orders
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — operations_suppliers
-- ─────────────────────────────────────────────────────────────────────────
alter table public.operations_suppliers enable row level security;

drop policy if exists "operations_suppliers_select" on public.operations_suppliers;
create policy "operations_suppliers_select" on public.operations_suppliers
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_suppliers_insert" on public.operations_suppliers;
create policy "operations_suppliers_insert" on public.operations_suppliers
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "operations_suppliers_update" on public.operations_suppliers;
create policy "operations_suppliers_update" on public.operations_suppliers
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — operations_orders
-- ─────────────────────────────────────────────────────────────────────────
alter table public.operations_orders enable row level security;

drop policy if exists "operations_orders_select" on public.operations_orders;
create policy "operations_orders_select" on public.operations_orders
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_orders_insert" on public.operations_orders;
create policy "operations_orders_insert" on public.operations_orders
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "operations_orders_update" on public.operations_orders;
create policy "operations_orders_update" on public.operations_orders
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );
