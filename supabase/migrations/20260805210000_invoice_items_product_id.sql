-- Link finance invoice line items to Operations products for stock decrement on invoice.paid.

alter table public.finance_invoice_items
  add column if not exists product_id uuid
    references public.operations_products (id) on delete set null;

comment on column public.finance_invoice_items.product_id is
  'Optional Operations product — stock decrements on invoice.paid when set.';

create index if not exists finance_invoice_items_product_idx
  on public.finance_invoice_items (business_id, product_id)
  where product_id is not null;

-- Idempotent cross-pillar handlers per invoice (e.g. stock decrement).
create table if not exists public.finance_invoice_handler_dedup (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  invoice_id    uuid not null,
  handler_key   text not null,
  processed_at  timestamptz not null default now(),
  primary key (business_id, invoice_id, handler_key)
);

comment on table public.finance_invoice_handler_dedup is
  'Idempotency ledger for invoice.paid side-effects (stock, etc.).';

alter table public.finance_invoice_handler_dedup enable row level security;

drop policy if exists "finance_invoice_handler_dedup_select" on public.finance_invoice_handler_dedup;
create policy "finance_invoice_handler_dedup_select" on public.finance_invoice_handler_dedup
  for select using (business_id = public.current_business_id());

drop policy if exists "finance_invoice_handler_dedup_insert" on public.finance_invoice_handler_dedup;
create policy "finance_invoice_handler_dedup_insert" on public.finance_invoice_handler_dedup
  for insert with check (business_id = public.current_business_id());
