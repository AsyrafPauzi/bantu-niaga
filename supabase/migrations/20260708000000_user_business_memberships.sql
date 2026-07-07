-- Multi-company: one auth user can belong to several businesses and switch
-- active context without signing out.

create table if not exists public.user_business_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null check (role in (
    'owner', 'manager', 'accountant', 'hr_officer', 'cashier', 'staff',
    'marketing_officer', 'operations_officer', 'sales_rep'
  )),
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create index if not exists user_business_memberships_user_idx
  on public.user_business_memberships (user_id);

create index if not exists user_business_memberships_business_idx
  on public.user_business_memberships (business_id);

alter table public.user_business_memberships enable row level security;

create policy "memberships_select_own" on public.user_business_memberships
  for select using (user_id = auth.uid());

create policy "memberships_select_same_business" on public.user_business_memberships
  for select using (business_id = public.current_business_id());

-- Backfill from existing users rows (one membership per current profile).
insert into public.user_business_memberships (user_id, business_id, role, display_name, email)
select u.id, u.business_id, u.role, u.display_name, u.email
from public.users u
on conflict (user_id, business_id) do nothing;

-- Businesses the user belongs to (for switcher dropdown).
create policy "businesses_select_via_membership" on public.businesses
  for select using (
    exists (
      select 1
      from public.user_business_memberships m
      where m.user_id = auth.uid()
        and m.business_id = businesses.id
    )
  );

comment on table public.user_business_memberships is
  'Source of truth for which businesses an auth user can access. public.users.business_id is the active context.';
