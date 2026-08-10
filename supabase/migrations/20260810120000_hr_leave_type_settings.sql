-- Per-business leave type defaults (quota + attachment rules)

create table if not exists public.hr_leave_type_settings (
  business_id uuid not null references public.businesses(id) on delete cascade,
  leave_type text not null check (
    leave_type in ('annual', 'emergency', 'mc', 'hospitalisation', 'unpaid')
  ),
  default_quota_days numeric(5, 1)
    check (default_quota_days is null or default_quota_days >= 0),
  attachment_required boolean not null default false,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (business_id, leave_type)
);

comment on table public.hr_leave_type_settings is
  'Global leave quotas and attachment rules per leave type for each business.';

drop trigger if exists hr_leave_type_settings_set_updated_at on public.hr_leave_type_settings;
create trigger hr_leave_type_settings_set_updated_at
  before update on public.hr_leave_type_settings
  for each row execute function public.set_updated_at();

alter table public.hr_leave_type_settings enable row level security;

create policy hr_leave_type_settings_select on public.hr_leave_type_settings
  for select using (business_id = public.current_business_id());

create policy hr_leave_type_settings_write on public.hr_leave_type_settings
  for all using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- Per-employee overrides for non-AL types (AL uses annual_leave_entitlement_days)
alter table public.hr_employees
  add column if not exists leave_entitlements jsonb not null default '{}'::jsonb;

comment on column public.hr_employees.leave_entitlements is
  'Optional per-type entitlement overrides, e.g. {"mc":14,"emergency":3,"hospitalisation":60}.';
