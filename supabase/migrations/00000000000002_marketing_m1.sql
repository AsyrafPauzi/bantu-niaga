-- ============================================================================
-- Bantu Niaga — Marketing pillar M1
-- ============================================================================
-- Phase 1 of the Marketing pillar (locked scope per docs/plans/marketing-
-- decisions.md and docs/plans/marketing-implementation-plan.md §11 M1).
--
-- What lands here:
--   1. pg_trgm extension (for fuzzy name matching in dedup).
--   2. Hardened JWT-aware `public.current_business_id()` and
--      `public.current_role()` helpers. They prefer the custom-access-token
--      hook's `app_metadata.business_id` / `.role` claims and fall back to a
--      `public.users` lookup so RLS keeps working when the hook is disabled.
--   3. Five Marketing-owned tables (plan §2):
--        - customers (with Q8 deleted_at soft-delete column)
--        - customer_tag_history
--        - customer_csv_imports
--        - content_plan
--        - content_plan_media
--      plus two cross-cutting tables tied to Marketing:
--        - customer_external_refs (Q5 — empty registry; downstream pillars
--          populate via their own migrations)
--        - marketing_event_dedup (assumption #11 — shipped now while it's
--          cheap; consumer is M6)
--   4. RLS policies on every table; SELECT path on customers excludes
--      soft-deleted rows by default (Q8).
--   5. INSERT policy on events_outbox so authenticated callers can append
--      domain events (the outbox-INSERT was previously blocked by RLS).
--   6. `public.marketing_create_customer(...)` SECURITY-INVOKER function
--      that inserts a customer + the matching `customer.created`
--      events_outbox row in a single Postgres transaction.
--   7. `public.custom_access_token_hook(event jsonb)` — Supabase Auth Hook
--      that enriches the JWT `app_metadata` with `business_id` + `role`
--      pulled from `public.users`. Must be enabled separately in the
--      Supabase dashboard (Auth → Hooks → Custom Access Token); the hook
--      function itself is created here so the dashboard can target it.
-- ============================================================================

create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_name_similarity
--
-- Thin wrapper over pg_trgm `similarity()` so the JS dedup helper can
-- request a fuzzy score via supabase.rpc() without depending on raw SQL.
-- Lowercases + trims both sides; returns 0..1.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_name_similarity(a text, b text)
returns real
language sql
immutable
as $$
  select similarity(lower(trim(coalesce(a, ''))), lower(trim(coalesce(b, ''))))::real;
$$;

grant execute on function public.marketing_name_similarity(text, text)
  to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- Hardened RBAC helpers — prefer JWT claim, fall back to public.users.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.current_business_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claim_raw text;
  v_business_id uuid;
begin
  begin
    v_claim_raw := current_setting('request.jwt.claims', true);
  exception when others then
    v_claim_raw := null;
  end;

  if v_claim_raw is not null and v_claim_raw <> '' then
    begin
      v_business_id := nullif(
        v_claim_raw::jsonb #>> '{app_metadata,business_id}',
        ''
      )::uuid;
    exception when others then
      v_business_id := null;
    end;
    if v_business_id is not null then
      return v_business_id;
    end if;
  end if;

  select business_id into v_business_id
    from public.users
    where id = auth.uid();
  return v_business_id;
end;
$$;

grant execute on function public.current_business_id() to authenticated;

create or replace function public.current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claim_raw text;
  v_role text;
begin
  begin
    v_claim_raw := current_setting('request.jwt.claims', true);
  exception when others then
    v_claim_raw := null;
  end;

  if v_claim_raw is not null and v_claim_raw <> '' then
    begin
      v_role := nullif(
        v_claim_raw::jsonb #>> '{app_metadata,role}',
        ''
      );
    exception when others then
      v_role := null;
    end;
    if v_role is not null then
      return v_role;
    end if;
  end if;

  select role into v_role
    from public.users
    where id = auth.uid();
  return v_role;
end;
$$;

grant execute on function public.current_role() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- events_outbox INSERT policy — required for any authenticated mutation
-- that appends a domain event. Was missing from the init migration.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "events_outbox_insert_self_business" on public.events_outbox;
create policy "events_outbox_insert_self_business" on public.events_outbox
  for insert with check (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- customers — manual_tags length guard
--
-- CHECK constraints can't contain subqueries, so the per-element length
-- guard lives in an IMMUTABLE helper function the constraint can call.
-- Pure, input-only — no table reads, safe to mark IMMUTABLE.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.manual_tags_lengths_ok(tags text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    (select bool_and(length(t) between 1 and 40) from unnest(tags) as t),
    true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references public.businesses(id) on delete cascade,

  name                text not null,
  phone_e164          text,
  email               text,
  address             text,

  manual_tags         text[] not null default '{}',
  auto_tags           text[] not null default '{}',

  notes               text,

  total_spend_myr     numeric(12, 2) not null default 0,
  last_purchase_at    timestamptz,
  order_count         integer not null default 0,
  aov_myr             numeric(12, 2) generated always as (
    case when order_count > 0 then total_spend_myr / order_count else 0 end
  ) stored,

  source              text not null default 'manual'
                      check (source in (
                        'pos', 'booking', 'lead_conversion',
                        'csv_import', 'manual', 'public_booking_page'
                      )),
  created_by_user_id  uuid references public.users(id) on delete set null,
  merged_into_id      uuid references public.customers(id) on delete set null,
  deleted_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint customers_manual_tags_cap
    check (array_length(manual_tags, 1) is null or array_length(manual_tags, 1) <= 20),
  constraint customers_manual_tag_length
    check (public.manual_tags_lengths_ok(manual_tags))
);

comment on table public.customers is
  'Canonical Customer entity for the whole system. Marketing-owned; referenced by Finance / Operations / Sales via customer_external_refs.';

create unique index if not exists customers_business_phone_unique
  on public.customers (business_id, phone_e164)
  where phone_e164 is not null
    and merged_into_id is null
    and deleted_at is null;

create index if not exists customers_business_idx
  on public.customers (business_id);
create index if not exists customers_business_last_purchase_idx
  on public.customers (business_id, last_purchase_at desc nulls last);
create index if not exists customers_business_name_trgm_idx
  on public.customers using gin (lower(name) gin_trgm_ops);
create index if not exists customers_auto_tags_idx
  on public.customers using gin (auto_tags);
create index if not exists customers_manual_tags_idx
  on public.customers using gin (manual_tags);
create index if not exists customers_deleted_at_idx
  on public.customers (deleted_at)
  where deleted_at is not null;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

drop policy if exists "customers_select_self_business" on public.customers;
create policy "customers_select_self_business" on public.customers
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

drop policy if exists "customers_insert_self_business" on public.customers;
create policy "customers_insert_self_business" on public.customers
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "customers_update_self_business" on public.customers;
create policy "customers_update_self_business" on public.customers
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (business_id = public.current_business_id());

drop policy if exists "customers_delete_self_business" on public.customers;
create policy "customers_delete_self_business" on public.customers
  for delete
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- customer_tag_history
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_tag_history (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  prior_auto_tags text[] not null,
  new_auto_tags   text[] not null,
  computed_at     timestamptz not null default now(),
  run_id          uuid
);

create index if not exists customer_tag_history_customer_idx
  on public.customer_tag_history (customer_id, computed_at desc);
create index if not exists customer_tag_history_business_idx
  on public.customer_tag_history (business_id, computed_at desc);

alter table public.customer_tag_history enable row level security;

drop policy if exists "customer_tag_history_select_self_business" on public.customer_tag_history;
create policy "customer_tag_history_select_self_business" on public.customer_tag_history
  for select using (business_id = public.current_business_id());

-- Inserts done by the Edge Function via service_role; no public insert policy.

-- ─────────────────────────────────────────────────────────────────────────
-- customer_csv_imports
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_csv_imports (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  uploaded_by     uuid references public.users(id) on delete set null,
  storage_path    text not null,
  original_name   text not null,
  row_count       integer,
  preview         jsonb,
  status          text not null default 'uploaded'
                  check (status in ('uploaded', 'previewed', 'committed', 'failed', 'expired')),
  committed_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  created_at      timestamptz not null default now()
);

create index if not exists customer_csv_imports_business_idx
  on public.customer_csv_imports (business_id, created_at desc);

alter table public.customer_csv_imports enable row level security;

drop policy if exists "csv_imports_self_business" on public.customer_csv_imports;
create policy "csv_imports_self_business" on public.customer_csv_imports
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- content_plan + content_plan_media
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.content_plan (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  channel       text not null check (channel in ('tiktok', 'instagram', 'facebook')),
  status        text not null default 'idea'
                check (status in ('idea', 'drafted', 'scheduled', 'posted')),
  scheduled_at  timestamptz,
  hook          text,
  caption       text,
  created_by    uuid references public.users(id) on delete set null,
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists content_plan_business_scheduled_idx
  on public.content_plan (business_id, scheduled_at);

drop trigger if exists content_plan_set_updated_at on public.content_plan;
create trigger content_plan_set_updated_at
  before update on public.content_plan
  for each row execute function public.set_updated_at();

alter table public.content_plan enable row level security;

drop policy if exists "content_plan_self_business" on public.content_plan;
create policy "content_plan_self_business" on public.content_plan
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- D6 contract: `file_id` is uuid without an FK in v1. Admin will land
-- public.files in a later migration; FK is added then.
create table if not exists public.content_plan_media (
  content_plan_id uuid not null references public.content_plan(id) on delete cascade,
  file_id         uuid not null,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  position        smallint not null default 0,
  primary key (content_plan_id, file_id)
);

create index if not exists content_plan_media_business_idx
  on public.content_plan_media (business_id);

alter table public.content_plan_media enable row level security;

drop policy if exists "content_plan_media_self_business" on public.content_plan_media;
create policy "content_plan_media_self_business" on public.content_plan_media
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- customer_external_refs (Q5) — empty registry; downstream pillars
-- register their own FK columns in their own migrations.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_external_refs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  fk_column     text not null,
  pillar        text not null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (table_name, fk_column)
);

alter table public.customer_external_refs enable row level security;

-- Registry is read-only application metadata, not tenant data. Visible to
-- all authenticated callers so the merge handler can enumerate downstream
-- FKs without escalating to service_role for a pure read.
drop policy if exists "customer_external_refs_select_authenticated" on public.customer_external_refs;
create policy "customer_external_refs_select_authenticated" on public.customer_external_refs
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- marketing_event_dedup (assumption #11) — per-handler idempotency table
-- for M6 cross-pillar event consumers. Ships empty now; M6 wires writers.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.marketing_event_dedup (
  event_id      uuid primary key,
  processed_at  timestamptz not null default now()
);

alter table public.marketing_event_dedup enable row level security;
-- No public policies; managed by the M6 event-listener Edge Function via
-- service_role. Explicit zero-policy posture keeps every authenticated
-- read/write denied.

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_create_customer
--
-- Inserts a customer row AND its matching `customer.created` outbox row
-- inside a single Postgres transaction (the function body is the txn).
-- security invoker → RLS still applies to both inserts as the caller.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_create_customer(
  p_business_id        uuid,
  p_name               text,
  p_phone_e164         text,
  p_email              text,
  p_address            text,
  p_manual_tags        text[],
  p_notes              text,
  p_source             text,
  p_created_by_user_id uuid
)
returns table (
  customer_id uuid,
  event_id    uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_event_id    uuid;
begin
  insert into public.customers (
    business_id, name, phone_e164, email, address,
    manual_tags, notes, source, created_by_user_id
  ) values (
    p_business_id, p_name, p_phone_e164, p_email, p_address,
    coalesce(p_manual_tags, '{}'::text[]), p_notes, p_source, p_created_by_user_id
  )
  returning id into v_customer_id;

  insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
  values (
    p_business_id,
    'customer.created',
    jsonb_build_object(
      'customer_id', v_customer_id,
      'phone_e164', p_phone_e164,
      'name', p_name,
      'source', p_source
    ),
    p_created_by_user_id
  )
  returning id into v_event_id;

  return query select v_customer_id, v_event_id;
end;
$$;

grant execute on function public.marketing_create_customer(
  uuid, text, text, text, text, text[], text, text, uuid
) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- public.custom_access_token_hook
--
-- Enriches JWT `app_metadata` with the user's role + business_id pulled
-- from public.users. If the user has no public.users row yet (e.g. mid-
-- signup), the event is returned unchanged so token issuance still
-- succeeds.
--
-- Must be enabled in Supabase Dashboard:
--   Auth → Hooks → Custom Access Token → Postgres function:
--   public.custom_access_token_hook
-- Without enabling it the function is dormant; the helper functions above
-- transparently fall back to a public.users lookup so the system still
-- works.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id        uuid;
  v_role           text;
  v_business_id    uuid;
  v_claims         jsonb;
  v_app_metadata   jsonb;
begin
  v_user_id := nullif(event->>'user_id', '')::uuid;
  if v_user_id is null then
    return event;
  end if;

  select role, business_id
    into v_role, v_business_id
    from public.users
    where id = v_user_id;

  if v_role is null or v_business_id is null then
    return event;
  end if;

  v_claims := coalesce(event->'claims', '{}'::jsonb);
  v_app_metadata := coalesce(v_claims->'app_metadata', '{}'::jsonb)
    || jsonb_build_object(
      'role', v_role,
      'business_id', v_business_id
    );

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_metadata);

  return jsonb_build_object('claims', v_claims);
end;
$$;

-- Grants required by the Supabase Auth hook runtime.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon;

-- The hook needs to read the users table; service-definer would also work
-- but it's cleaner to grant a narrow read directly to supabase_auth_admin.
grant select on public.users to supabase_auth_admin;
