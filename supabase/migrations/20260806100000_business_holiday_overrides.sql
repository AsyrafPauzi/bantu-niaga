-- Per-business holiday overrides: company closures, suppress gazetted days, replacement days.

create table if not exists public.business_holiday_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  override_type text not null check (
    override_type in ('add', 'suppress', 'replace')
  ),
  holiday_date date not null,
  replaces_holiday_id uuid references public.hr_public_holidays (id) on delete set null,
  name text check (name is null or length(name) between 1 and 160),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.users (id) on delete set null
);

comment on table public.business_holiday_overrides is
  'Per-business adjustments to the public holiday calendar (closures, opt-outs, replacement days).';

comment on column public.business_holiday_overrides.override_type is
  'add = extra closure; suppress = business open on gazetted day; replace = move holiday to another date.';

create index if not exists business_holiday_overrides_business_idx
  on public.business_holiday_overrides (business_id, holiday_date);

alter table public.business_holiday_overrides enable row level security;

create policy business_holiday_overrides_select_hr_roles
  on public.business_holiday_overrides
  for select
  using (business_id = public.current_business_id());

create policy business_holiday_overrides_insert_hr_roles
  on public.business_holiday_overrides
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy business_holiday_overrides_delete_hr_roles
  on public.business_holiday_overrides
  for delete
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
