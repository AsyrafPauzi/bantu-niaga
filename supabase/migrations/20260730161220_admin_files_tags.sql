-- Optional multi-tag labels on admin_files (beyond single category).
alter table public.admin_files
  add column if not exists tags text[] not null default '{}';

comment on column public.admin_files.tags is
  'Optional free-form tags for filtering (max enforced in API).';

create index if not exists admin_files_tags_gin_idx
  on public.admin_files using gin (tags)
  where deleted_at is null;
