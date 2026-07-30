-- Operations product stock tracking for low-stock overview (Phase 1 B5)
alter table public.operations_products
  add column if not exists stock_qty integer,
  add column if not exists low_stock_threshold integer not null default 5;

comment on column public.operations_products.stock_qty is
  'On-hand quantity; NULL = stock not tracked for this SKU.';
comment on column public.operations_products.low_stock_threshold is
  'Alert when stock_qty is set and falls to this level or below.';

alter table public.operations_products
  drop constraint if exists operations_products_stock_qty_nonneg;
alter table public.operations_products
  add constraint operations_products_stock_qty_nonneg
  check (stock_qty is null or stock_qty >= 0);

alter table public.operations_products
  drop constraint if exists operations_products_low_stock_threshold_nonneg;
alter table public.operations_products
  add constraint operations_products_low_stock_threshold_nonneg
  check (low_stock_threshold >= 0);
