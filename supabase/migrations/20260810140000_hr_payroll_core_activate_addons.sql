-- Payroll is HR core (hide/remove payroll addons from catalog).
-- Activate shift attendance + reminder pack for all businesses.
-- Store employer statutory lines on payslips.

-- ─── Payslip employer contributions ───────────────────────────────────────
alter table public.hr_payslips
  add column if not exists employer_contributions jsonb not null default '[]'::jsonb;

comment on column public.hr_payslips.employer_contributions is
  'Employer EPF/SOCSO/EIS lines (MYR) for the payslip period.';

-- ─── Remove payroll addons from marketplace catalog ───────────────────────
update public.marketplace_addons
   set status = 'disabled',
       is_coming_soon = true,
       is_featured = false
 where slug in ('hr-payroll-pack', 'hr-payroll-statutory', 'payroll-bank-export');

-- ─── Ensure attendance addon exists, then make both live ──────────────────
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

-- ─── Auto-activate for every existing business ────────────────────────────
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
