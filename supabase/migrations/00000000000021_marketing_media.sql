-- ============================================================================
-- Bantu Niaga — Marketing pillar · Content media storage
-- ============================================================================
-- Lands the Marketing media surface used by the Content > New Post page
-- ("Photo / Video / Carousel / Upload" buttons). Mirrors the Admin
-- Storage pair (00000000000019) but:
--
--   - separate table:  public.marketing_files
--   - separate bucket: marketing-media
--   - role gate:       owner + manager only (no hr_officer; this is a
--                      marketing surface, not an admin one)
--
-- The decision to keep marketing_files distinct from admin_files (rather
-- than reusing admin-files with category='marketing_media') is documented
-- in the marketing-core-v1.1 media spec: it keeps the permission scope
-- per pillar clean, avoids leaking HR docs into marketing list views,
-- and means the `content_plan_media.file_id` FK target can be added
-- later without forcing the admin_files schema to absorb marketing-only
-- columns (width_px / height_px / duration_ms).
--
-- What lands here:
--   1. public.marketing_files — one row per uploaded media file
--      (metadata only; bytes live in the marketing-media bucket).
--   2. set_updated_at trigger reusing public.set_updated_at() from init.
--   3. RLS on marketing_files:
--        - SELECT: same business + not soft-deleted
--        - INSERT / UPDATE: same business AND role in (owner, manager)
--        - DELETE: denied (the API soft-deletes via update set deleted_at)
--   4. Private `marketing-media` Supabase Storage bucket + storage.objects
--      RLS policies (same path convention as admin-files:
--      <business_id>/<random>/<sanitised_name>).
--   5. DB-level CHECK that file_size_bytes is in (0, 104857600] — the
--      last line of defense for the 100 MB cap (also enforced in the API
--      and on the client).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- marketing_files
--
-- One row per uploaded media file. Metadata stays in Postgres so list /
-- tenant scoping all use the same RLS-protected query path as the rest
-- of the app. The bytes live in the `marketing-media` Storage bucket
-- under <business_id>/<random>/<sanitised_name> — that prefix is
-- enforced by the storage.objects policies further down.
--
-- The optional width_px / height_px / duration_ms columns are reserved
-- for future image/video probing (e.g. a thumbnailer Edge Function);
-- the v1 API leaves them NULL.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.marketing_files (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  uploaded_by       uuid not null references auth.users(id) on delete restrict,

  storage_path      text not null,
  file_name         text not null
                    check (length(file_name) between 1 and 255),
  mime_type         text not null,
  -- 100 MB hard cap. The API + client also gate on this; the CHECK is
  -- the last line of defense so even a service-role bug can't insert
  -- oversized metadata rows.
  file_size_bytes   bigint not null
                    check (file_size_bytes > 0 and file_size_bytes <= 104857600),

  -- Optional probe fields. Set when MIME is image/* or video/*.
  width_px          integer,
  height_px         integer,
  duration_ms       integer,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.marketing_files is
  'Marketing media — metadata for files uploaded into the marketing-media Storage bucket (used by the Content > New Post media picker).';

-- List query (newest-first, exclude soft-deleted) hits this index.
create index if not exists marketing_files_business_active_idx
  on public.marketing_files (business_id, created_at desc)
  where deleted_at is null;

drop trigger if exists marketing_files_set_updated_at on public.marketing_files;
create trigger marketing_files_set_updated_at
  before update on public.marketing_files
  for each row execute function public.set_updated_at();

alter table public.marketing_files enable row level security;

-- SELECT: own business, exclude soft-deleted by default.
drop policy if exists "marketing_files_select_self_business" on public.marketing_files;
create policy "marketing_files_select_self_business" on public.marketing_files
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

-- INSERT: own business + role in (owner, manager). No hr_officer here —
-- marketing surfaces are not granted to HR Officer in lib/permissions.ts.
drop policy if exists "marketing_files_insert_self_business" on public.marketing_files;
create policy "marketing_files_insert_self_business" on public.marketing_files
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- UPDATE: same gate as INSERT. Used for soft-delete (deleted_at) and
-- any future metadata edits.
drop policy if exists "marketing_files_update_self_business" on public.marketing_files;
create policy "marketing_files_update_self_business" on public.marketing_files
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- DELETE: denied outright. Soft-delete only.
-- (No policy = no rows match = every DELETE returns 0 rows. The absence
-- of a policy is the deny.)

-- ─────────────────────────────────────────────────────────────────────────
-- marketing-media Supabase Storage bucket
--
-- Private (public=false). Path convention:
--   marketing-media/<business_id>/<random>/<sanitised_name>
--
-- The API uses the service-role client to issue signed upload + download
-- URLs against this bucket; the RLS policies below are defence-in-depth
-- for any accidental anon/authenticated read via the Storage REST API.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('marketing-media', 'marketing-media', false)
on conflict (id) do nothing;

drop policy if exists "marketing_media_storage_select" on storage.objects;
create policy "marketing_media_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marketing-media'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "marketing_media_storage_insert" on storage.objects;
create policy "marketing_media_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-media'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "marketing_media_storage_update" on storage.objects;
create policy "marketing_media_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marketing-media'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    bucket_id = 'marketing-media'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "marketing_media_storage_delete" on storage.objects;
create policy "marketing_media_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketing-media'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );
