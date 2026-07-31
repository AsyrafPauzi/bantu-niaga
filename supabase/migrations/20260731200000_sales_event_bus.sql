-- Sales event bus: dedup table for idempotent cross-pillar handlers.

create table if not exists public.sales_event_dedup (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  sale_id       uuid not null references public.pos_sales (id) on delete cascade,
  event_name    text not null check (event_name in ('sale.completed', 'sale.voided')),
  processed_at  timestamptz not null default now(),
  primary key (business_id, sale_id, event_name)
);

comment on table public.sales_event_dedup is
  'Idempotency guard for sale.completed / sale.voided sync handlers.';

create index if not exists sales_event_dedup_business_idx
  on public.sales_event_dedup (business_id, processed_at desc);

alter table public.sales_event_dedup enable row level security;

drop policy if exists "sales_event_dedup_select" on public.sales_event_dedup;
create policy "sales_event_dedup_select" on public.sales_event_dedup
  for select using (business_id = public.current_business_id());
