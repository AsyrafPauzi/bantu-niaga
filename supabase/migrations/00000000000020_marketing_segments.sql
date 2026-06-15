-- ============================================================================
-- Bantu Niaga — Marketing v1.1, Phase 1: customer_segments
-- ============================================================================
-- Lands ONLY the `customer_segments` table from the v1.1 spec
-- (docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md
--  §3). Sibling workers add `broadcasts`, `coupons`, and their related
-- tables in subsequent migrations to keep the parallel phase-2 workers
-- from colliding on a single file.
--
-- What lands here:
--   1. public.customer_segments — saved cohort table (auto + custom).
--   2. Indexes for the common filters (business_id, kind, soft-delete).
--   3. RLS policies per spec §3:
--        - SELECT: same business, not soft-deleted
--        - INSERT / UPDATE: owner, manager (custom only — auto rows are
--          immutable; enforced in the API and by an UPDATE check)
--        - DELETE: denied (soft-delete only path)
--   4. Per-business seed: 5 auto segments (vip, repeat, new, at_risk,
--      dormant) for every existing business, one INSERT … SELECT.
--
-- Naming note: the original spec §11 named this file
-- `00000000000020_marketing_segments_broadcasts_coupons.sql` and bundled
-- all five tables. Splitting the migration per worker keeps the
-- parallel phase-2 schedule (coupons || broadcasts) sane. Each worker
-- owns its own migration number.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- customer_segments
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_segments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,

  name            text not null check (length(name) between 1 and 80),
  kind            text not null check (kind in ('auto', 'custom')),
  auto_key        text check (auto_key in ('vip','repeat','new','at_risk','dormant')),
  rules           jsonb,             -- null when kind='auto'

  -- Cached counts (refreshed on read; cheap because resolver is a single SQL query).
  member_count    integer not null default 0,
  member_count_at timestamptz,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  -- One auto segment per (business, auto_key). NULL auto_key (custom rows)
  -- is treated as distinct in default Postgres NULL semantics so a business
  -- can have many custom segments.
  --
  -- Deviation from spec §3: the spec markup says "deferrable initially
  -- deferred". We drop deferrable because ON CONFLICT (used by the seed
  -- INSERT … SELECT below and by the seedAutoSegmentsForBusiness helper)
  -- is incompatible with deferrable unique constraints. Auto-segment
  -- bookkeeping doesn't need the deferred-check window; the kind/auto_key
  -- pair is set once at insert and never updated.
  constraint customer_segments_business_auto_key_unique
    unique (business_id, auto_key),

  -- Custom segments must have rules; auto segments must not.
  constraint customer_segments_kind_shape
    check (
      (kind = 'auto'   and auto_key is not null and rules is null)
      or
      (kind = 'custom' and auto_key is null     and rules is not null)
    )
);

comment on table public.customer_segments is
  'Saved customer cohorts. kind=auto rows are seeded one-per-business at migration time (mirroring the five auto-tags). kind=custom rows are owner/manager-created with a JSON rules document. See lib/marketing/segments-rules.ts for the rules shape.';

create index if not exists customer_segments_business_idx
  on public.customer_segments (business_id);

create index if not exists customer_segments_business_kind_idx
  on public.customer_segments (business_id, kind);

create index if not exists customer_segments_deleted_at_idx
  on public.customer_segments (deleted_at)
  where deleted_at is not null;

drop trigger if exists customer_segments_set_updated_at on public.customer_segments;
create trigger customer_segments_set_updated_at
  before update on public.customer_segments
  for each row execute function public.set_updated_at();

alter table public.customer_segments enable row level security;

-- SELECT: same business, soft-deleted rows excluded by default.
drop policy if exists "customer_segments_select_self_business" on public.customer_segments;
create policy "customer_segments_select_self_business" on public.customer_segments
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

-- INSERT: owner/manager only. Custom rows only — auto rows are seeded by
-- this migration via service-role and by the seedAutoSegmentsForBusiness
-- helper (also service-role) when a new business is created.
drop policy if exists "customer_segments_insert_self_business" on public.customer_segments;
create policy "customer_segments_insert_self_business" on public.customer_segments
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
    and kind = 'custom'
  );

-- UPDATE: owner/manager only. Auto rows are immutable from the API
-- (the route handler returns 409); the policy enforces it at the DB layer
-- too by refusing any UPDATE whose target row is an auto segment.
drop policy if exists "customer_segments_update_self_business" on public.customer_segments;
create policy "customer_segments_update_self_business" on public.customer_segments
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
    and kind = 'custom'
  )
  with check (
    business_id = public.current_business_id()
    and kind = 'custom'
  );

-- No DELETE policy: rows are soft-deleted via UPDATE deleted_at.
-- Hard delete only available via service-role (e.g. cascade from the
-- businesses table).

-- ─────────────────────────────────────────────────────────────────────────
-- Per-business auto-segment seed.
--
-- Five rows per existing business, idempotent via ON CONFLICT against
-- the unique (business_id, auto_key) constraint. The display name is the
-- human-friendly label; auto_key is the canonical machine key used by
-- the rules resolver and broadcast/coupon attach-to-segment flows.
--
-- Note: the customers.auto_tags array stores `at-risk` (hyphen) for
-- historical reasons (see lib/marketing/auto-tags.ts). The segment
-- auto_key is `at_risk` (underscore) per the v1.1 spec; the resolver
-- normalises between the two so this remains internally consistent.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.customer_segments (business_id, name, kind, auto_key)
select b.id, k.label, 'auto'::text, k.key
from public.businesses b
cross join (values
  ('VIP',     'vip'),
  ('Repeat',  'repeat'),
  ('New',     'new'),
  ('At-risk', 'at_risk'),
  ('Dormant', 'dormant')
) as k(label, key)
on conflict (business_id, auto_key) do nothing;
