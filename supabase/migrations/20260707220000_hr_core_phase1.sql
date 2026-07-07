-- HR Core Phase 1: leave balances, sensitive field sealing, holiday import meta, marketplace placeholders.

-- ── Leave entitlement on employee ────────────────────────────────────────────
alter table public.hr_employees
  add column if not exists annual_leave_entitlement_days numeric(5, 1) not null default 8;

comment on column public.hr_employees.annual_leave_entitlement_days is
  'Core AL entitlement per calendar year (working days). Advanced policy rules are a paid add-on.';

-- ── Sealed sensitive fields (AES-256-GCM JSON via app; plaintext cleared on write) ──
alter table public.hr_employees
  add column if not exists identity_number_sealed jsonb,
  add column if not exists bank_account_no_sealed jsonb;

-- ── Per-employee annual leave balance tally ────────────────────────────────────
create table if not exists public.hr_leave_balances (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_year smallint not null,
  entitlement_days numeric(5, 1) not null default 8,
  taken_days numeric(5, 1) not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_year)
);

create index if not exists hr_leave_balances_business_year_idx
  on public.hr_leave_balances (business_id, leave_year);

drop trigger if exists hr_leave_balances_set_updated_at on public.hr_leave_balances;
create trigger hr_leave_balances_set_updated_at
  before update on public.hr_leave_balances
  for each row execute function public.set_updated_at();

alter table public.hr_leave_balances enable row level security;

create policy hr_leave_balances_select_hr_roles on public.hr_leave_balances
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_leave_balances_write_hr_roles on public.hr_leave_balances
  for all using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- ── Holiday import provenance ─────────────────────────────────────────────────
alter table public.hr_public_holidays
  add column if not exists source text check (source is null or length(source) <= 40),
  add column if not exists external_id text check (external_id is null or length(external_id) <= 120);

-- ── Marketplace coming-soon flag ──────────────────────────────────────────────
alter table public.marketplace_addons
  add column if not exists is_coming_soon boolean not null default false;

-- Deprecate duplicate holiday sync slug in favour of hr-public-holidays
update public.marketplace_addons
   set status = 'disabled',
       is_coming_soon = false
 where slug = 'holiday-calendar-sync';

-- ── Paid HR add-on placeholders (coming soon) ───────────────────────────────
insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order, is_featured, is_coming_soon, status
)
values
  (
    'hr-advanced-leave-policy',
    'Advanced Leave Policy',
    'Carry-forward, pro-rated AL, and hard balance rules',
    'Automate AL carry-forward with caps, pro-rated entitlement for mid-year joiners, custom EL/MC rules, and team leave calendar. Coming soon.',
    'hr', 'file-check', 2900, 'monthly', 91, false, true, 'live'
  ),
  (
    'hr-contract-letters',
    'Contract & Letter Generator',
    'Offer, confirmation, and termination letters as PDFs',
    'Generate branded employment letters from templates and store signed copies. Coming soon.',
    'hr', 'file-check', 3900, 'monthly', 92, false, true, 'live'
  ),
  (
    'hr-shift-roster',
    'Shift Roster',
    'Weekly shift grid for your team',
    'Plan shifts, assign staff, and see who is on duty. Coming soon.',
    'hr', 'users', 4900, 'monthly', 93, false, true, 'live'
  ),
  (
    'hr-time-clock',
    'Time Clock',
    'Clock in and out from mobile',
    'Track attendance with simple clock events and daily summaries. Coming soon.',
    'hr', 'zap', 3900, 'monthly', 94, false, true, 'live'
  ),
  (
    'hr-payroll-pack',
    'Payroll & Statutory Pack',
    'EPF, SOCSO, EIS, PCB estimates and bank export',
    'Payroll estimates and statutory contribution workflows for Malaysian SMEs. Coming soon.',
    'hr', 'shopping-bag', 9900, 'monthly', 95, false, true, 'live'
  ),
  (
    'hr-reminder-pack',
    'HR Reminder Pack',
    'Contract expiry, probation, and document nudges',
    'Automated reminders for HR deadlines your team should not miss. Coming soon.',
    'hr', 'sparkles', 1900, 'monthly', 96, false, true, 'live'
  ),
  (
    'hr-staff-portal',
    'Staff Self-Service Portal',
    'Staff login to view leave balance and apply for leave',
    'Give staff their own login to check balances, history, and apply for leave. Coming soon.',
    'hr', 'user-plus', 2900, 'monthly', 97, false, true, 'live'
  )
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  price_cents = excluded.price_cents,
  is_coming_soon = excluded.is_coming_soon,
  status = excluded.status;
