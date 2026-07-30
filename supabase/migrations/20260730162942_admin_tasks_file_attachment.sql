-- Optional storage file attachment on admin tasks.
alter table public.admin_tasks
  add column if not exists admin_file_id uuid references public.admin_files(id) on delete set null;

comment on column public.admin_tasks.admin_file_id is
  'Optional link to a file in Admin Storage attached to this task.';

create index if not exists admin_tasks_admin_file_id_idx
  on public.admin_tasks (admin_file_id)
  where deleted_at is null and admin_file_id is not null;
