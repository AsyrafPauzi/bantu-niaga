-- Customisable Admin task board columns (per business).

create table if not exists public.admin_task_columns (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  label        text not null check (char_length(trim(label)) between 1 and 40),
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  sort_order   integer not null default 0,
  is_done      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

comment on table public.admin_task_columns is
  'Kanban columns for Admin tasks — owners/managers can add, rename, or remove.';

create unique index if not exists admin_task_columns_business_slug_active_idx
  on public.admin_task_columns (business_id, slug)
  where deleted_at is null;

create index if not exists admin_task_columns_business_sort_active_idx
  on public.admin_task_columns (business_id, sort_order)
  where deleted_at is null;

drop trigger if exists admin_task_columns_set_updated_at on public.admin_task_columns;
create trigger admin_task_columns_set_updated_at
  before update on public.admin_task_columns
  for each row execute function public.set_updated_at();

alter table public.admin_task_columns enable row level security;

drop policy if exists "admin_task_columns_select" on public.admin_task_columns;
create policy "admin_task_columns_select" on public.admin_task_columns
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "admin_task_columns_insert" on public.admin_task_columns;
create policy "admin_task_columns_insert" on public.admin_task_columns
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "admin_task_columns_update" on public.admin_task_columns;
create policy "admin_task_columns_update" on public.admin_task_columns
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- Seed default columns for every business that has none yet.
insert into public.admin_task_columns (business_id, label, slug, sort_order, is_done)
select
  b.id,
  v.label,
  v.slug,
  v.sort_order,
  v.is_done
from public.businesses b
cross join (
  values
    ('To do', 'todo', 0, false),
    ('Doing', 'doing', 1, false),
    ('Done', 'done', 2, true)
) as v(label, slug, sort_order, is_done)
where not exists (
  select 1
  from public.admin_task_columns c
  where c.business_id = b.id
    and c.deleted_at is null
);

drop index if exists admin_tasks_business_active_idx;
alter table public.admin_tasks
  add column if not exists column_id uuid references public.admin_task_columns(id);

update public.admin_tasks t
set column_id = c.id
from public.admin_task_columns c
where t.column_id is null
  and t.business_id = c.business_id
  and c.deleted_at is null
  and c.slug = t.status;

-- Fallback: unmapped tasks land in the first column.
update public.admin_tasks t
set column_id = c.id
from public.admin_task_columns c
where t.column_id is null
  and t.business_id = c.business_id
  and c.deleted_at is null
  and c.sort_order = (
    select min(c2.sort_order)
    from public.admin_task_columns c2
    where c2.business_id = t.business_id
      and c2.deleted_at is null
  );

alter table public.admin_tasks
  alter column column_id set not null;

alter table public.admin_tasks
  drop constraint if exists admin_tasks_status_check;

alter table public.admin_tasks
  drop column if exists status;

create index if not exists admin_tasks_column_active_idx
  on public.admin_tasks (business_id, column_id, sort_order)
  where deleted_at is null;
