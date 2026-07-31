-- Sales core enhancements: void sales, coupon linkage, service line items.

alter table public.pos_sales
  drop constraint if exists pos_sales_status_check;

alter table public.pos_sales
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id) on delete set null,
  add column if not exists void_reason text;

alter table public.pos_sales
  add constraint pos_sales_status_check
  check (status in ('completed', 'voided'));

comment on column public.pos_sales.coupon_id is
  'Marketing coupon applied at checkout (if any).';

alter table public.pos_sale_items
  add column if not exists service_id uuid references public.operations_services (id) on delete set null;

comment on column public.pos_sale_items.service_id is
  'Operations service when the line is a service (product_id may be null).';

create index if not exists pos_sales_business_status_idx
  on public.pos_sales (business_id, status, created_at desc);
