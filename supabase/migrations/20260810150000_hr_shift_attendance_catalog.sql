-- Ensure hr-shift-attendance catalog row exists and activate for all businesses.

insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon,
  price_cents, cadence, sort_order, is_featured, is_coming_soon, status
)
values (
  'hr-shift-attendance',
  'Shift & Attendance',
  'Clock in/out and daily attendance for your team',
  'Track attendance with clock events, manager review, and staff self-service. Included for partner testing.',
  'hr', 'zap', 1600, 'monthly', 93, false, false, 'live'
)
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  price_cents = excluded.price_cents,
  is_coming_soon = false,
  status = 'live';

update public.marketplace_addons
   set is_coming_soon = false,
       status = 'live'
 where slug in ('hr-shift-attendance', 'hr-reminder-pack');

insert into public.business_addons (
  business_id, addon_id, qty, status, activated_at, next_charge_at
)
select
  b.id,
  a.id,
  1,
  'active',
  now(),
  now() + interval '1 month'
from public.businesses b
cross join public.marketplace_addons a
where a.slug in ('hr-shift-attendance', 'hr-reminder-pack')
  and a.status = 'live'
  and not exists (
    select 1
    from public.business_addons ba
    where ba.business_id = b.id
      and ba.addon_id = a.id
  );
