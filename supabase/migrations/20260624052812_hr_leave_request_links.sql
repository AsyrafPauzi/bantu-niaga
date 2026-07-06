-- ============================================================================
-- Bantu Niaga — HR staff leave request links
-- ============================================================================
-- One-time, 24-hour self-service leave links for employees. Tokens are stored
-- only as SHA-256 hashes; the plaintext token is shown once to HR for sharing.
-- ============================================================================

create table if not exists public.hr_leave_request_links (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists hr_leave_request_links_business_employee_idx
  on public.hr_leave_request_links (business_id, employee_id, created_at desc);

create index if not exists hr_leave_request_links_token_active_idx
  on public.hr_leave_request_links (token_hash)
  where used_at is null and revoked_at is null;

drop trigger if exists hr_leave_request_links_set_updated_at
  on public.hr_leave_request_links;
create trigger hr_leave_request_links_set_updated_at
  before update on public.hr_leave_request_links
  for each row execute function public.set_updated_at();

alter table public.hr_leave_request_links enable row level security;

create policy hr_leave_request_links_select_hr_roles
  on public.hr_leave_request_links
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_leave_request_links_insert_hr_roles
  on public.hr_leave_request_links
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy hr_leave_request_links_update_hr_roles
  on public.hr_leave_request_links
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
