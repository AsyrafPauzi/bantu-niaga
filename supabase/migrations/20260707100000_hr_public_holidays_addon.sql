-- Free Marketplace add-on: Malaysian public holiday calendar (HR pillar).
-- Owners activate/deactivate from Marketplace. When inactive, daily HR notices
-- and AI briefings omit public holiday data.

insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order, is_featured
)
values (
  'hr-public-holidays',
  'Public Holiday Calendar',
  'Malaysian federal & state holidays — free',
  'Track upcoming public holidays for your business state. When enabled, Hana includes holiday reminders in daily HR notices. Manage your calendar from HR → Public holidays.',
  'hr',
  'calendar',
  0,
  'one_time',
  16,
  false
)
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  pillar = excluded.pillar,
  price_cents = excluded.price_cents,
  cadence = excluded.cadence,
  sort_order = excluded.sort_order;
