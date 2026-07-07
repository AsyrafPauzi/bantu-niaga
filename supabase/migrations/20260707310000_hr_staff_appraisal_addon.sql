-- HR add-on: Staff Appraisal Checker — track review cycles and due dates per employee.

create table if not exists public.hr_staff_appraisals (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  period_label text not null check (length(period_label) between 1 and 80),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  notes text check (notes is null or length(notes) <= 1000),
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, employee_id, period_label)
);

create index if not exists hr_staff_appraisals_business_status_idx
  on public.hr_staff_appraisals (business_id, status, due_date);

create index if not exists hr_staff_appraisals_employee_idx
  on public.hr_staff_appraisals (business_id, employee_id, due_date desc);

drop trigger if exists hr_staff_appraisals_set_updated_at on public.hr_staff_appraisals;
create trigger hr_staff_appraisals_set_updated_at
  before update on public.hr_staff_appraisals
  for each row execute function public.set_updated_at();

alter table public.hr_staff_appraisals enable row level security;

create policy hr_staff_appraisals_select_hr_roles
  on public.hr_staff_appraisals for select
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_staff_appraisals_insert_hr_roles
  on public.hr_staff_appraisals for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_staff_appraisals_update_hr_roles
  on public.hr_staff_appraisals for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order, is_featured, is_coming_soon, status
)
values (
  'hr-staff-appraisal',
  'Staff Appraisal Checker',
  'Track performance reviews and due dates for your team',
  'Schedule annual or quarterly appraisals per staff member, see who is overdue, record ratings, and mark reviews complete. Hana can remind you about pending appraisals.',
  'hr',
  'clipboard-check',
  2900,
  'monthly',
  17,
  false,
  false,
  'live'
)
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  price_cents = excluded.price_cents,
  cadence = excluded.cadence,
  sort_order = excluded.sort_order,
  is_coming_soon = excluded.is_coming_soon,
  status = excluded.status;
