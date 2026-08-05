-- Cross-module polish: order→lead FK, ensure booking resource employee_id indexed.

alter table public.sales_leads
  add column if not exists source_order_id uuid references public.operations_orders (id) on delete set null;

comment on column public.sales_leads.source_order_id is
  'Operations order this lead was created from (manual or auto).';

create unique index if not exists sales_leads_source_order_uidx
  on public.sales_leads (business_id, source_order_id)
  where source_order_id is not null;

create index if not exists operations_booking_resources_employee_idx
  on public.operations_booking_resources (business_id, employee_id)
  where deleted_at is null and employee_id is not null;
