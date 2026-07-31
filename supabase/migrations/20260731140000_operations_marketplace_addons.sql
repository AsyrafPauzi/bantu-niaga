-- Operations scale add-ons: variants, public booking, auto stock deduction.

insert into public.marketplace_addons (
  slug,
  name,
  short_desc,
  long_desc,
  pillar,
  icon,
  price_cents,
  cadence,
  sort_order,
  is_featured,
  is_coming_soon
)
values
  (
    'product-variants',
    'Product variants',
    'Size, colour, and package options under one SKU.',
    'Add size, colour, flavour, weight, or package variants under a single product — ideal for apparel, footwear, and retail.',
    'operations',
    'layers',
    2900,
    'monthly',
    20,
    true,
    true
  ),
  (
    'customer-booking-page',
    'Customer booking page',
    'Public link for customers to self-book services.',
    'Share a secure booking page so customers pick a service, date, and time without calling or messaging you.',
    'operations',
    'calendar-check',
    2900,
    'monthly',
    21,
    true,
    true
  ),
  (
    'auto-stock-deduction',
    'Auto stock deduction',
    'POS and paid invoices reduce stock automatically.',
    'When a sale completes in POS or an invoice is marked paid, stock quantities update without manual adjustments.',
    'operations',
    'package-minus',
    2500,
    'monthly',
    22,
    false,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  pillar = excluded.pillar,
  icon = excluded.icon,
  price_cents = excluded.price_cents,
  cadence = excluded.cadence,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  is_coming_soon = excluded.is_coming_soon;
