-- ============================================================================
-- 00000000000017_pdpa.sql
--
-- Personal Data Protection Act (PDPA Malaysia 2010, as amended) compliance.
--
-- This migration adds the schema needed to honour the seven PDPA principles
-- when a tenant (or any of their users) exercises a data-subject right:
--
--   - Right to access            → POST /api/privacy/export
--   - Right to rectification     → already covered (settings/business etc.)
--   - Right to erasure           → POST /api/privacy/delete (with grace)
--   - Right to data portability  → export endpoint returns machine-readable JSON
--   - Right to withdraw consent  → POST /api/privacy/consents (toggle each)
--   - Right to object            → consent toggles below
--   - DSR audit trail            → data_subject_requests is the canonical log
--
-- Schema:
--   1. data_subject_requests   one row per DSR (export / delete / consent /
--                              rectification). Cross-tenant (platform admins
--                              can see all requests; tenants only their own).
--   2. user_consents           one row per (user, consent_kind) with the
--                              latest grant/withdrawal timestamp. Append-only
--                              history is captured via audit_log.
--   3. users.deletion_*        soft-delete fields used during the grace
--                              period before a hard delete.
--   4. businesses.deletion_*   same, but at the tenant level (owner-initiated
--                              full account closure).
--   5. data_exports            ephemeral cache of generated export bundles
--                              (auto-purged 7 days after creation).
--
-- The hard-delete worker is the `privacy_execute_pending_deletions()` RPC
-- below — run it once an hour from an Edge Function or a Vercel cron.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. data_subject_requests
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.data_subject_requests (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,

  kind                  text not null
                        check (kind in (
                          'export',           -- right to access + portability
                          'delete_user',      -- right to erasure (user-only)
                          'delete_business',  -- right to erasure (full tenant)
                          'rectify',          -- right to rectification (logged for compliance)
                          'consent_change',   -- consent grant / withdrawal
                          'object'            -- right to object to processing
                        )),
  status                text not null default 'pending'
                        check (status in (
                          'pending',           -- received, not yet actioned
                          'in_progress',       -- being executed
                          'awaiting_grace',    -- delete request — waiting for grace period to expire
                          'completed',
                          'cancelled',         -- user cancelled before execution
                          'failed'
                        )),

  -- Free-form context for the support team. Never put PII payload here.
  reason                text,
  -- Snapshot of detail at request-time (e.g. which consents toggled). JSON
  -- blob so we can extend without schema churn.
  payload               jsonb default '{}'::jsonb,
  -- IP/UA at request-time for compliance audits (PDPA s.36 — security).
  source_ip             inet,
  user_agent            text,

  scheduled_for         timestamptz,           -- when status='awaiting_grace', this is the hard-delete due date
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.data_subject_requests is
  'Canonical log of every PDPA data-subject right exercised by a user. '
  'Retained for 7 years after `completed_at` per s.7 (data integrity & audit).';

create index if not exists data_subject_requests_business_idx
  on public.data_subject_requests (business_id, created_at desc);
create index if not exists data_subject_requests_user_idx
  on public.data_subject_requests (user_id, created_at desc);
create index if not exists data_subject_requests_status_idx
  on public.data_subject_requests (status)
  where status in ('pending', 'in_progress', 'awaiting_grace');
create index if not exists data_subject_requests_scheduled_idx
  on public.data_subject_requests (scheduled_for)
  where scheduled_for is not null and status = 'awaiting_grace';

alter table public.data_subject_requests enable row level security;

-- Users see only their own; platform admins see everything.
create policy dsr_select on public.data_subject_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
  );

-- Users can insert their own DSRs (we trust the API route to set business_id correctly).
create policy dsr_insert on public.data_subject_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- Only the user themselves can cancel a pending DSR; admins can update anything.
create policy dsr_update on public.data_subject_requests
  for update to authenticated
  using (
    (user_id = auth.uid() and status in ('pending', 'awaiting_grace'))
    or public.is_platform_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_platform_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. user_consents — latest state per (user, kind)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.user_consents (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,

  -- The catalog of consent kinds is closed; new ones require a migration so
  -- we have a paper trail of what consent the user actually granted.
  kind                  text not null
                        check (kind in (
                          'terms_of_service',     -- baseline contract
                          'privacy_notice',       -- PDPA s.7 — notice & choice
                          'marketing_email',      -- promotional emails from us
                          'product_updates',      -- product newsletters
                          'ai_training',          -- use anonymised tenant data to improve AI
                          'analytics',            -- product analytics
                          'third_party_share'     -- share with sub-processors beyond strict-necessity
                        )),

  granted               boolean not null,
  -- Version of the document/notice the user consented to (e.g. '2026-06-14').
  policy_version        text,

  granted_at            timestamptz,
  withdrawn_at          timestamptz,
  source_ip             inet,
  user_agent            text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (user_id, kind)
);

comment on table public.user_consents is
  'Latest consent state per (user, kind). Full history lives in audit_log '
  'with action=''privacy.consent_change''. Required by PDPA s.6 (consent).';

create index if not exists user_consents_business_idx
  on public.user_consents (business_id);
create index if not exists user_consents_user_idx
  on public.user_consents (user_id);

alter table public.user_consents enable row level security;

create policy user_consents_select on public.user_consents
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
  );

create policy user_consents_modify on public.user_consents
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. users.deletion_* — soft-delete fields used during grace period
-- ─────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists users_deletion_scheduled_idx
  on public.users (deletion_scheduled_for)
  where deletion_scheduled_for is not null and deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. businesses.deletion_* — owner-initiated tenant closure
-- ─────────────────────────────────────────────────────────────────────────
alter table public.businesses
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists businesses_deletion_scheduled_idx
  on public.businesses (deletion_scheduled_for)
  where deletion_scheduled_for is not null and deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. data_exports — short-lived export bundles
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.data_exports (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  request_id            uuid not null references public.data_subject_requests(id) on delete cascade,
  -- Cached export payload (JSON). Capped at the typical free-tier row count;
  -- for very large tenants we'd switch to a signed URL to Supabase Storage.
  payload               jsonb not null,
  byte_size             integer not null default 0,
  -- Hard expiry: 7 days from creation. The cron in the RPC below deletes
  -- expired rows. Users can re-request fresh exports any time.
  expires_at            timestamptz not null default (now() + interval '7 days'),
  created_at            timestamptz not null default now()
);

comment on table public.data_exports is
  'Short-lived cache of generated DSR export bundles. Auto-purged after 7 days.';

create index if not exists data_exports_user_idx
  on public.data_exports (user_id, created_at desc);
create index if not exists data_exports_expires_idx
  on public.data_exports (expires_at);

alter table public.data_exports enable row level security;

create policy data_exports_select on public.data_exports
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. _touch trigger for updated_at on the new tables
-- ─────────────────────────────────────────────────────────────────────────
drop trigger if exists data_subject_requests_touch on public.data_subject_requests;
create trigger data_subject_requests_touch
  before update on public.data_subject_requests
  for each row execute function public._touch_updated_at();

drop trigger if exists user_consents_touch on public.user_consents;
create trigger user_consents_touch
  before update on public.user_consents
  for each row execute function public._touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. RPC: privacy_execute_pending_deletions
--
--   Sweep all DSRs whose grace period has elapsed and execute the
--   actual hard-deletion. Run hourly via Edge Function or Vercel cron.
--   Designed to be safe to re-run: it short-circuits on rows already
--   marked completed.
--
--   The hard-delete of the auth.users row is left to the calling worker
--   because supabase admin operations need the service-role key on a
--   privileged client (RPC runs as the request's caller).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.privacy_execute_pending_deletions()
returns table (
  request_id  uuid,
  kind        text,
  user_id     uuid,
  business_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  if not public.is_platform_admin() then
    raise exception 'privacy_execute_pending_deletions: caller is not a platform admin';
  end if;

  for r in
    select id, kind as dsr_kind, user_id as dsr_user, business_id as dsr_business
    from public.data_subject_requests
    where status = 'awaiting_grace'
      and scheduled_for is not null
      and scheduled_for <= now()
  loop
    -- Mark in-progress so a concurrent worker doesn't double-handle.
    update public.data_subject_requests
      set status = 'in_progress', updated_at = now()
      where id = r.id;

    if r.dsr_kind = 'delete_user' then
      update public.users
        set deleted_at = now(),
            display_name = null,
            email = null,
            phone_e164 = null,
            avatar_url = null
        where id = r.dsr_user;
    elsif r.dsr_kind = 'delete_business' then
      -- Soft-mark the business; the auth.users + storage cascade is
      -- handled by the calling worker (service-role).
      update public.businesses
        set deleted_at = now()
        where id = r.dsr_business;
      update public.users
        set deleted_at = now()
        where business_id = r.dsr_business;
    end if;

    update public.data_subject_requests
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = r.id;

    request_id  := r.id;
    kind        := r.dsr_kind;
    user_id     := r.dsr_user;
    business_id := r.dsr_business;
    return next;
  end loop;

  -- Cleanup expired exports while we're here.
  delete from public.data_exports where expires_at <= now();
end;
$$;

revoke all on function public.privacy_execute_pending_deletions() from public;
grant execute on function public.privacy_execute_pending_deletions() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. (best-effort defensive) avatar_url + last_password_change_at exist
-- ─────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists avatar_url text,
  add column if not exists last_password_change_at timestamptz;
