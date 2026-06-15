-- ============================================================================
-- Bantu Niaga — Admin pillar · Digital Storage
-- ============================================================================
-- Phase 1 of the Admin Digital Storage surface.
--
-- What lands here:
--   1. `public.admin_files` — one row per uploaded file (metadata only;
--      bytes live in the `admin-files` Storage bucket).
--   2. Trigger to bump updated_at on every row mutation, reusing the
--      existing public.set_updated_at() trigger function from init.
--   3. RLS on admin_files:
--        - SELECT: same business + not soft-deleted
--        - INSERT / UPDATE: same business AND role in
--          (owner, manager, hr_officer)
--        - DELETE: denied (the API soft-deletes via update set deleted_at)
--   4. Private `admin-files` Supabase Storage bucket + storage.objects
--      RLS policies mirroring the M3 csv-imports pattern (same-business
--      owner / manager / hr_officer, with the path's first segment being
--      the business UUID).
--   5. DB-level CHECK that file_size_bytes is in (0, 104857600] — the
--      last line of defense for the 100 MB cap (also enforced in the API
--      and on the client).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- admin_files
--
-- One row per uploaded file. Metadata stays in Postgres so list / search /
-- soft-delete / tenant scoping all use the same RLS-protected query path
-- the rest of the app uses. The bytes live in the `admin-files` Storage
-- bucket under <business_id>/<random>/<sanitised_name> — that prefix is
-- enforced by the storage.objects policies further down.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_files (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  uploaded_by       uuid not null references auth.users(id) on delete restrict,

  storage_path      text not null,
  file_name         text not null
                    check (length(file_name) between 1 and 255),
  mime_type         text not null,
  -- 100 MB hard cap. The API + client also gate on this; the CHECK is the
  -- last line of defense so even a service-role bug can't insert oversized
  -- metadata rows.
  file_size_bytes   bigint not null
                    check (file_size_bytes > 0 and file_size_bytes <= 104857600),

  -- Free-form optional tag — used by the HR Officer scoping (forces
  -- category='hr_doc' on that role) and by the future category filter.
  category          text,
  description       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.admin_files is
  'Admin Digital Storage — metadata for files uploaded into the admin-files Storage bucket.';

-- List query (newest-first, exclude soft-deleted) hits this index.
create index if not exists admin_files_business_active_idx
  on public.admin_files (business_id, created_at desc)
  where deleted_at is null;

-- Optional: filter by category (used by HR Officer scoping, plus the
-- category pills in the UI).
create index if not exists admin_files_business_category_active_idx
  on public.admin_files (business_id, category)
  where deleted_at is null;

drop trigger if exists admin_files_set_updated_at on public.admin_files;
create trigger admin_files_set_updated_at
  before update on public.admin_files
  for each row execute function public.set_updated_at();

alter table public.admin_files enable row level security;

-- SELECT: own business, exclude soft-deleted by default (matches the
-- customers / marketing pattern).
drop policy if exists "admin_files_select_self_business" on public.admin_files;
create policy "admin_files_select_self_business" on public.admin_files
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

-- INSERT: own business + role in (owner, manager, hr_officer). The API
-- layer additionally forces category='hr_doc' for hr_officer.
drop policy if exists "admin_files_insert_self_business" on public.admin_files;
create policy "admin_files_insert_self_business" on public.admin_files
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- UPDATE: same gate as INSERT. Used for soft-delete (deleted_at) and
-- future metadata edits.
drop policy if exists "admin_files_update_self_business" on public.admin_files;
create policy "admin_files_update_self_business" on public.admin_files
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

-- DELETE: denied outright. Soft-delete only.
-- (No policy = no rows match = every DELETE returns 0 rows. The absence
-- of a policy is the deny.)

-- ─────────────────────────────────────────────────────────────────────────
-- admin-files Supabase Storage bucket
--
-- Private (public=false). Path convention:
--   admin-files/<business_id>/<random>/<sanitised_name>
--
-- The API uses the service-role client to issue signed upload + download
-- URLs against this bucket; the RLS policies below are defence-in-depth
-- for any accidental anon/authenticated read via the Storage REST API.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', false)
on conflict (id) do nothing;

drop policy if exists "admin_files_storage_select" on storage.objects;
create policy "admin_files_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'admin-files'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

drop policy if exists "admin_files_storage_insert" on storage.objects;
create policy "admin_files_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'admin-files'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

drop policy if exists "admin_files_storage_update" on storage.objects;
create policy "admin_files_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'admin-files'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    bucket_id = 'admin-files'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

drop policy if exists "admin_files_storage_delete" on storage.objects;
create policy "admin_files_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'admin-files'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
