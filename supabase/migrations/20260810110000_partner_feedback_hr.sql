-- Partner feedback HR: leave types, employee fields, attendance, warnings, payslips

-- ─── Leave types ───────────────────────────────────────────────────────────
alter table public.hr_leave_records
  drop constraint if exists hr_leave_records_leave_type_check;

alter table public.hr_leave_records
  add constraint hr_leave_records_leave_type_check
  check (
    leave_type in (
      'annual',
      'emergency',
      'mc',
      'hospitalisation',
      'unpaid'
    )
  );

-- ─── Employee profile fields ───────────────────────────────────────────────
alter table public.hr_employees
  add column if not exists employee_number text
    check (employee_number is null or length(employee_number) between 1 and 40),
  add column if not exists contract_end_date date,
  add column if not exists base_salary_myr numeric(12, 2)
    check (base_salary_myr is null or base_salary_myr >= 0);

create unique index if not exists hr_employees_business_employee_number_idx
  on public.hr_employees (business_id, employee_number)
  where employee_number is not null and deleted_at is null;

comment on column public.hr_employees.employee_number is
  'Human-readable staff ID (unique per business).';
comment on column public.hr_employees.contract_end_date is
  'Contract end date for renewal reminders.';
comment on column public.hr_employees.base_salary_myr is
  'Monthly base salary for payslip and cost reporting (optional).';

-- ─── Attendance (hr-shift-attendance addon) ────────────────────────────────
create table if not exists public.hr_clock_events (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'manual' check (source in ('manual', 'self', 'manager')),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);

create index if not exists hr_clock_events_business_employee_idx
  on public.hr_clock_events (business_id, employee_id, clock_in desc);

alter table public.hr_clock_events enable row level security;

create policy hr_clock_events_select on public.hr_clock_events
  for select using (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager', 'hr_officer')
      or employee_id in (
        select e.id from public.hr_employees e
        where e.business_id = public.current_business_id()
          and e.user_id = (select auth.uid())
          and e.deleted_at is null
      )
    )
  );

create policy hr_clock_events_insert on public.hr_clock_events
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_clock_events_update on public.hr_clock_events
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- ─── Warning letters ───────────────────────────────────────────────────────
create table if not exists public.hr_warning_letters (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  issued_at date not null,
  reason text not null check (length(reason) between 1 and 2000),
  severity text not null default 'standard' check (
    severity in ('verbal', 'standard', 'final')
  ),
  admin_file_id uuid references public.admin_files(id) on delete set null,
  issued_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hr_warning_letters_business_employee_idx
  on public.hr_warning_letters (business_id, employee_id, issued_at desc);

alter table public.hr_warning_letters enable row level security;

create policy hr_warning_letters_select on public.hr_warning_letters
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_warning_letters_insert on public.hr_warning_letters
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- ─── Payslips ──────────────────────────────────────────────────────────────
create table if not exists public.hr_payslips (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_myr numeric(12, 2) not null check (gross_myr >= 0),
  deductions jsonb not null default '[]'::jsonb,
  net_myr numeric(12, 2) not null check (net_myr >= 0),
  pdf_path text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists hr_payslips_business_employee_idx
  on public.hr_payslips (business_id, employee_id, period_start desc);

alter table public.hr_payslips enable row level security;

create policy hr_payslips_select_hr on public.hr_payslips
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_payslips_select_self on public.hr_payslips
  for select using (
    business_id = public.current_business_id()
    and employee_id in (
      select e.id from public.hr_employees e
      where e.business_id = public.current_business_id()
        and e.user_id = (select auth.uid())
        and e.deleted_at is null
    )
  );

create policy hr_payslips_insert on public.hr_payslips
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
