-- Operations core completion: ready stage, fulfillment, product images, services catalogue.

-- ── Order pipeline: add "ready" stage + fulfillment fields ─────────────────
alter table public.operations_orders
  drop constraint if exists operations_orders_status_check;

alter table public.operations_orders
  add constraint operations_orders_status_check
  check (status in ('todo', 'in_progress', 'ready', 'done'));

alter table public.operations_orders
  add column if not exists fulfillment_type text not null default 'pickup'
    check (fulfillment_type in ('pickup', 'delivery'));

alter table public.operations_orders
  add column if not exists fulfillment_status text not null default 'pending'
    check (
      fulfillment_status in (
        'pending',
        'ready_for_pickup',
        'out_for_delivery',
        'delivered'
      )
    );

comment on column public.operations_orders.fulfillment_type is
  'Pickup or delivery — drives fulfillment_status options.';
comment on column public.operations_orders.fulfillment_status is
  'Pickup/delivery progress for customer handoff.';

-- ── Product catalogue image ───────────────────────────────────────────────
alter table public.operations_products
  add column if not exists image_file_id uuid
    references public.admin_files (id) on delete set null;

comment on column public.operations_products.image_file_id is
  'Optional product photo from Admin Storage.';

create index if not exists operations_products_image_file_idx
  on public.operations_products (business_id, image_file_id)
  where deleted_at is null and image_file_id is not null;

-- ── Service catalogue (bookings + orders reference by name or id) ───────
create table if not exists public.operations_services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  name              text not null check (char_length(trim(name)) > 0),
  description       text,
  duration_minutes  integer not null default 60 check (duration_minutes > 0),
  price_myr         numeric(12, 2) check (price_myr is null or price_myr >= 0),
  is_active         boolean not null default true,
  notes             text,
  created_by        uuid not null references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint operations_services_name_per_business unique (business_id, name)
);

comment on table public.operations_services is
  'Service catalogue — duration and default price for bookings.';

create index if not exists operations_services_business_idx
  on public.operations_services (business_id, name)
  where deleted_at is null;

drop trigger if exists operations_services_set_updated_at on public.operations_services;
create trigger operations_services_set_updated_at
  before update on public.operations_services
  for each row execute function public.set_updated_at();

alter table public.operations_bookings
  add column if not exists service_id uuid
    references public.operations_services (id) on delete set null;

-- RLS — operations_services
alter table public.operations_services enable row level security;

drop policy if exists "operations_services_select" on public.operations_services;
create policy "operations_services_select" on public.operations_services
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "operations_services_insert" on public.operations_services;
create policy "operations_services_insert" on public.operations_services
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'operations_officer')
  );

drop policy if exists "operations_services_update" on public.operations_services;
create policy "operations_services_update" on public.operations_services
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'operations_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'operations_officer')
  );
