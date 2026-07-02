-- ============================================================================
-- Bantu Niaga — HR core
-- ============================================================================
-- Core HR for Growth/Pro:
--   1. Employee profiles and sensitive staff details.
--   2. Staff document metadata linked to Admin Storage where available.
--   3. Basic leave records and approval state.
--   4. Onboarding checklist items.
--   5. Public holiday reference rows.
--
-- Payroll, roster, time clock, self-service forms, statutory payroll, and AI
-- remain add-ons and intentionally do not land in this migration.
-- ============================================================================

create table if not exists public.hr_employees (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,

  full_name text not null check (length(full_name) between 1 and 160),
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'contract', 'intern')
  ),
  role_title text not null check (length(role_title) between 1 and 120),
  start_date date not null,
  status text not null default 'active' check (
    status in ('active', 'inactive', 'terminated')
  ),

  identity_type text check (identity_type in ('ic', 'passport')),
  identity_number text check (identity_number is null or length(identity_number) <= 80),
  phone_e164 text check (phone_e164 is null or length(phone_e164) <= 24),
  email text check (email is null or length(email) <= 160),

  emergency_contact_name text check (
    emergency_contact_name is null or length(emergency_contact_name) <= 160
  ),
  emergency_contact_relationship text check (
    emergency_contact_relationship is null or length(emergency_contact_relationship) <= 80
  ),
  emergency_contact_phone text check (
    emergency_contact_phone is null or length(emergency_contact_phone) <= 24
  ),

  bank_name text check (bank_name is null or length(bank_name) <= 120),
  bank_account_no text check (bank_account_no is null or length(bank_account_no) <= 80),
  bank_account_holder text check (
    bank_account_holder is null or length(bank_account_holder) <= 160
  ),

  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.hr_employees is
  'HR core employee profiles. Sensitive fields are readable only through HR-authorized roles.';

create index if not exists hr_employees_business_active_idx
  on public.hr_employees (business_id, created_at desc)
  where deleted_at is null;

create index if not exists hr_employees_business_status_idx
  on public.hr_employees (business_id, status)
  where deleted_at is null;

create index if not exists hr_employees_business_user_idx
  on public.hr_employees (business_id, user_id)
  where user_id is not null and deleted_at is null;

drop trigger if exists hr_employees_set_updated_at on public.hr_employees;
create trigger hr_employees_set_updated_at
  before update on public.hr_employees
  for each row execute function public.set_updated_at();

create table if not exists public.hr_employee_documents (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  admin_file_id uuid references public.admin_files(id) on delete set null,
  document_type text not null check (
    document_type in ('ic', 'passport', 'bank', 'medical', 'contract', 'other')
  ),
  label text not null check (length(label) between 1 and 160),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists hr_employee_documents_business_employee_idx
  on public.hr_employee_documents (business_id, employee_id, created_at desc)
  where deleted_at is null;

drop trigger if exists hr_employee_documents_set_updated_at on public.hr_employee_documents;
create trigger hr_employee_documents_set_updated_at
  before update on public.hr_employee_documents
  for each row execute function public.set_updated_at();

create table if not exists public.hr_leave_records (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('annual', 'emergency', 'mc')),
  start_date date not null,
  end_date date not null,
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  requested_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists hr_leave_records_business_status_idx
  on public.hr_leave_records (business_id, status, start_date desc);

create index if not exists hr_leave_records_business_employee_idx
  on public.hr_leave_records (business_id, employee_id, start_date desc);

drop trigger if exists hr_leave_records_set_updated_at on public.hr_leave_records;
create trigger hr_leave_records_set_updated_at
  before update on public.hr_leave_records
  for each row execute function public.set_updated_at();

create table if not exists public.hr_onboarding_items (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  label text not null check (length(label) between 1 and 160),
  is_done boolean not null default false,
  completed_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_onboarding_items_business_employee_idx
  on public.hr_onboarding_items (business_id, employee_id, is_done);

drop trigger if exists hr_onboarding_items_set_updated_at on public.hr_onboarding_items;
create trigger hr_onboarding_items_set_updated_at
  before update on public.hr_onboarding_items
  for each row execute function public.set_updated_at();

create table if not exists public.hr_public_holidays (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade,
  state_code text check (state_code is null or length(state_code) <= 12),
  holiday_date date not null,
  name text not null check (length(name) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (business_id, state_code, holiday_date, name)
);

create index if not exists hr_public_holidays_lookup_idx
  on public.hr_public_holidays (business_id, state_code, holiday_date);

alter table public.hr_employees enable row level security;
alter table public.hr_employee_documents enable row level security;
alter table public.hr_leave_records enable row level security;
alter table public.hr_onboarding_items enable row level security;
alter table public.hr_public_holidays enable row level security;

-- Employee profiles: HR-authorized roles only.
create policy hr_employees_select_hr_roles on public.hr_employees
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_employees_insert_hr_roles on public.hr_employees
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_employees_update_hr_roles on public.hr_employees
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- Employee documents: same HR gate; actual bytes stay in Admin Storage.
create policy hr_employee_documents_select_hr_roles on public.hr_employee_documents
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_employee_documents_write_hr_roles on public.hr_employee_documents
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_employee_documents_update_hr_roles on public.hr_employee_documents
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- Leave records: HR roles manage all; staff may read their own leave only.
create policy hr_leave_records_select_allowed on public.hr_leave_records
  for select using (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager', 'hr_officer')
      or exists (
        select 1
        from public.hr_employees e
        where e.id = hr_leave_records.employee_id
          and e.business_id = hr_leave_records.business_id
          and e.user_id = (select auth.uid())
          and e.deleted_at is null
      )
    )
  );

create policy hr_leave_records_insert_hr_roles on public.hr_leave_records
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_leave_records_update_hr_roles on public.hr_leave_records
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_onboarding_items_select_hr_roles on public.hr_onboarding_items
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_onboarding_items_insert_hr_roles on public.hr_onboarding_items
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_onboarding_items_update_hr_roles on public.hr_onboarding_items
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- Holidays can be global (business_id is null) or business-specific.
create policy hr_public_holidays_select_allowed on public.hr_public_holidays
  for select using (
    business_id is null or business_id = public.current_business_id()
  );

create policy hr_public_holidays_write_hr_roles on public.hr_public_holidays
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
