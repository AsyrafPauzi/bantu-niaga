-- ============================================================================
-- Bantu Niaga — Operations pillar · Products + Bookings
-- ============================================================================
-- Product catalog for POS/order pipeline and appointment/reservation tracking.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- operations_products
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.operations_products (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  sku             text not null check (char_length(trim(sku)) > 0),
  name            text not null check (char_length(trim(name)) > 0),
  description     text,
  category        text,
  price_myr       numeric(12, 2) not null default 0 check (price_myr >= 0),
  is_active       boolean not null default true,
  notes           text,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint operations_products_sku_per_business unique (business_id, sku)
);

comment on table public.operations_products is
  'Product catalog — SKU, price, category for Operations / future POS.';

create index if not exists operations_products_business_category_idx
  on public.operations_products (business_id, category, name)
  where deleted_at is null;

drop trigger if exists operations_products_set_updated_at on public.operations_products;
create trigger operations_products_set_updated_at
  before update on public.operations_products
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- operations_booking_resources
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.operations_booking_resources (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null check (char_length(trim(name)) > 0),
  description     text,
  buffer_minutes  integer not null default 0 check (buffer_minutes >= 0),
  is_active       boolean not null default true,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on table public.operations_booking_resources is
  'Bookable resources — room, chair, vehicle, instructor slot, etc.';

create index if not exists operations_booking_resources_business_idx
  on public.operations_booking_resources (business_id, name)
  where deleted_at is null;

drop trigger if exists operations_booking_resources_set_updated_at on public.operations_booking_resources;
create trigger operations_booking_resources_set_updated_at
  before update on public.operations_booking_resources
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- operations_bookings
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.operations_bookings (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  number          text not null,
  resource_id     uuid references public.operations_booking_resources(id) on delete set null,
  customer_name   text not null check (char_length(trim(customer_name)) > 0),
  customer_phone  text,
  service_title   text not null check (char_length(trim(service_title)) > 0),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'held'
                  check (status in ('held', 'confirmed', 'completed', 'cancelled')),
  amount_myr      numeric(12, 2) check (amount_myr is null or amount_myr >= 0),
  notes           text,
  completed_at    timestamptz,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint operations_bookings_number_per_business unique (business_id, number),
  constraint operations_bookings_time_order check (ends_at > starts_at)
);

comment on table public.operations_bookings is
  'Customer bookings — held → confirmed → completed (or cancelled).';

create index if not exists operations_bookings_business_starts_idx
  on public.operations_bookings (business_id, starts_at)
  where deleted_at is null and status <> 'cancelled';

create index if not exists operations_bookings_business_status_idx
  on public.operations_bookings (business_id, status, starts_at)
  where deleted_at is null;

drop trigger if exists operations_bookings_set_updated_at on public.operations_bookings;
create trigger operations_bookings_set_updated_at
  before update on public.operations_bookings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — operations_products
-- ─────────────────────────────────────────────────────────────────────────
alter table public.operations_products enable row level security;

drop policy if exists "operations_products_select" on public.operations_products;
create policy "operations_products_select" on public.operations_products
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_products_insert" on public.operations_products;
create policy "operations_products_insert" on public.operations_products
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "operations_products_update" on public.operations_products;
create policy "operations_products_update" on public.operations_products
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — operations_booking_resources
-- ─────────────────────────────────────────────────────────────────────────
alter table public.operations_booking_resources enable row level security;

drop policy if exists "operations_booking_resources_select" on public.operations_booking_resources;
create policy "operations_booking_resources_select" on public.operations_booking_resources
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_booking_resources_insert" on public.operations_booking_resources;
create policy "operations_booking_resources_insert" on public.operations_booking_resources
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "operations_booking_resources_update" on public.operations_booking_resources;
create policy "operations_booking_resources_update" on public.operations_booking_resources
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — operations_bookings
-- ─────────────────────────────────────────────────────────────────────────
alter table public.operations_bookings enable row level security;

drop policy if exists "operations_bookings_select" on public.operations_bookings;
create policy "operations_bookings_select" on public.operations_bookings
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_bookings_insert" on public.operations_bookings;
create policy "operations_bookings_insert" on public.operations_bookings
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "operations_bookings_update" on public.operations_bookings;
create policy "operations_bookings_update" on public.operations_bookings
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );
