-- Add optional barcode column to operations_products.
-- Barcode is scanned at POS to auto-add item to cart.
-- Unique per business (ignoring deleted products).

alter table public.operations_products
  add column if not exists barcode text;

create unique index if not exists operations_products_barcode_per_business
  on public.operations_products (business_id, barcode)
  where deleted_at is null and barcode is not null;

comment on column public.operations_products.barcode is
  'Optional EAN/UPC/QR barcode value. Scanned at POS to auto-add item to cart.';
