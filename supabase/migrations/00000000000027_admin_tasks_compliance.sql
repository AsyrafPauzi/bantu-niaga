-- ============================================================================
-- Bantu Niaga — Admin pillar · Tasks + License / Permit tracker
-- ============================================================================
--   1. `public.admin_tasks` — simple to-do list (todo → doing → done)
--   2. `public.admin_compliance_items` — SSM, DBKL, and other renewals
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- admin_tasks
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_tasks (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  title             text not null check (char_length(trim(title)) > 0),
  description       text,
  status            text not null default 'todo'
                    check (status in ('todo', 'doing', 'done')),
  due_date          date,
  assignee_user_id  uuid references public.users(id) on delete set null,
  created_by        uuid not null references auth.users(id) on delete restrict,
  sort_order        integer not null default 0,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.admin_tasks is
  'Admin to-do list — one board per business with todo / doing / done columns.';

create index if not exists admin_tasks_business_active_idx
  on public.admin_tasks (business_id, status, sort_order)
  where deleted_at is null;

create index if not exists admin_tasks_assignee_idx
  on public.admin_tasks (assignee_user_id)
  where deleted_at is null and assignee_user_id is not null;

drop trigger if exists admin_tasks_set_updated_at on public.admin_tasks;
create trigger admin_tasks_set_updated_at
  before update on public.admin_tasks
  for each row execute function public.set_updated_at();

alter table public.admin_tasks enable row level security;

drop policy if exists "admin_tasks_select" on public.admin_tasks;
create policy "admin_tasks_select" on public.admin_tasks
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
    and (
      public.current_role() in ('owner', 'manager')
      or assignee_user_id = auth.uid()
    )
  );

drop policy if exists "admin_tasks_insert" on public.admin_tasks;
create policy "admin_tasks_insert" on public.admin_tasks
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "admin_tasks_update" on public.admin_tasks;
create policy "admin_tasks_update" on public.admin_tasks
  for update
  using (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager')
      or assignee_user_id = auth.uid()
    )
  )
  with check (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager')
      or assignee_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- admin_compliance_items
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_compliance_items (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  title             text not null check (char_length(trim(title)) > 0),
  category          text not null default 'other'
                    check (category in (
                      'ssm', 'dbkl', 'halal', 'food_handler',
                      'insurance', 'tenancy', 'tax', 'other'
                    )),
  authority         text,
  reference_number  text,
  expires_on        date not null,
  remind_days       integer[] not null default '{30,14,3}',
  notes             text,
  status            text not null default 'active'
                    check (status in ('active', 'renewed', 'archived')),
  last_renewed_at   timestamptz,
  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.admin_compliance_items is
  'License & permit expiry tracker — SSM, DBKL signboard, halal, insurance, etc.';

create index if not exists admin_compliance_business_active_idx
  on public.admin_compliance_items (business_id, expires_on)
  where deleted_at is null and status = 'active';

drop trigger if exists admin_compliance_set_updated_at on public.admin_compliance_items;
create trigger admin_compliance_set_updated_at
  before update on public.admin_compliance_items
  for each row execute function public.set_updated_at();

alter table public.admin_compliance_items enable row level security;

drop policy if exists "admin_compliance_select" on public.admin_compliance_items;
create policy "admin_compliance_select" on public.admin_compliance_items
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "admin_compliance_insert" on public.admin_compliance_items;
create policy "admin_compliance_insert" on public.admin_compliance_items
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "admin_compliance_update" on public.admin_compliance_items;
create policy "admin_compliance_update" on public.admin_compliance_items
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );
