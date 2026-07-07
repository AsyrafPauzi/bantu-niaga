-- Pending team invitations (Settings → Team & roles).

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in (
    'manager', 'accountant', 'hr_officer', 'cashier', 'staff'
  )),
  display_name text,
  invited_by uuid references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  auth_user_id uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists team_invites_pending_email_idx
  on public.team_invites (business_id, lower(email))
  where status = 'pending';

create index if not exists team_invites_business_idx
  on public.team_invites (business_id, created_at desc);

alter table public.team_invites enable row level security;

create policy "team_invites_select_own_business" on public.team_invites
  for select using (business_id = public.current_business_id());

create policy "team_invites_owner_insert" on public.team_invites
  for insert with check (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "team_invites_owner_update" on public.team_invites
  for update using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );
