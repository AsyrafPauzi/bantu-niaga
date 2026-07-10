-- Sales POS core: sales + line items, static DuitNow QR on business.
-- Core payments: cash | duitnow_qr_static only (dynamic = add-on later).

alter table public.businesses
  add column if not exists duitnow_qr_url text;

comment on column public.businesses.duitnow_qr_url is
  'Public URL of static DuitNow QR image for POS / invoice pay panels.';

create table if not exists public.pos_sales (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  sale_number              text not null,
  cashier_user_id          uuid not null references auth.users (id) on delete restrict,
  customer_id              uuid references public.customers (id) on delete set null,
  customer_name            text,

  subtotal_myr             numeric(12, 2) not null check (subtotal_myr >= 0),
  discount_type            text check (discount_type is null or discount_type in ('amount', 'pct')),
  discount_value           numeric(12, 2) check (discount_value is null or discount_value >= 0),
  discount_amount_myr      numeric(12, 2) not null default 0 check (discount_amount_myr >= 0),
  sst_amount_myr           numeric(12, 2) not null default 0 check (sst_amount_myr >= 0),
  total_myr                numeric(12, 2) not null check (total_myr >= 0),

  payment_method           text not null check (
    payment_method in ('cash', 'duitnow_qr_static')
  ),
  payment_received_myr     numeric(12, 2),
  change_myr               numeric(12, 2) not null default 0,
  payment_note             text,

  status                   text not null default 'completed'
                           check (status in ('completed')),
  finance_transaction_id   uuid references public.finance_transactions (id) on delete set null,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint pos_sales_number_per_business unique (business_id, sale_number)
);

comment on table public.pos_sales is
  'POS ring-up — core Sales. Paid-in-full cash or static DuitNow.';

create index if not exists pos_sales_business_created_idx
  on public.pos_sales (business_id, created_at desc);

create index if not exists pos_sales_business_cashier_idx
  on public.pos_sales (business_id, cashier_user_id, created_at desc);

drop trigger if exists pos_sales_set_updated_at on public.pos_sales;
create trigger pos_sales_set_updated_at
  before update on public.pos_sales
  for each row execute function public.set_updated_at();

create table if not exists public.pos_sale_items (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  sale_id           uuid not null references public.pos_sales (id) on delete cascade,
  product_id        uuid references public.operations_products (id) on delete set null,
  product_name      text not null,
  product_sku       text,
  unit_price_myr    numeric(12, 2) not null check (unit_price_myr >= 0),
  quantity          numeric(12, 3) not null check (quantity > 0),
  line_total_myr    numeric(12, 2) not null check (line_total_myr >= 0),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

comment on table public.pos_sale_items is
  'Line items for pos_sales — product snapshot at sale time.';

create index if not exists pos_sale_items_sale_idx
  on public.pos_sale_items (sale_id, sort_order);

-- RLS
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;

drop policy if exists "pos_sales_select" on public.pos_sales;
create policy "pos_sales_select" on public.pos_sales
  for select using (
    business_id = public.current_business_id()
  );

drop policy if exists "pos_sales_insert" on public.pos_sales;
create policy "pos_sales_insert" on public.pos_sales
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in (
      'owner', 'manager', 'cashier', 'sales_rep'
    )
  );

drop policy if exists "pos_sales_update" on public.pos_sales;
create policy "pos_sales_update" on public.pos_sales
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (business_id = public.current_business_id());

drop policy if exists "pos_sale_items_select" on public.pos_sale_items;
create policy "pos_sale_items_select" on public.pos_sale_items
  for select using (
    business_id = public.current_business_id()
  );

drop policy if exists "pos_sale_items_insert" on public.pos_sale_items;
create policy "pos_sale_items_insert" on public.pos_sale_items
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in (
      'owner', 'manager', 'cashier', 'sales_rep'
    )
  );
