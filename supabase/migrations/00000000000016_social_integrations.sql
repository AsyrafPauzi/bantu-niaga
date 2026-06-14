-- ============================================================================
-- 00000000000016_social_integrations.sql
--
-- Marketing M7 — Meta (Facebook + Instagram Business) integrations.
--
-- Three tables:
--   1. public.social_accounts          — one row per connected FB Page / IG
--      Business account. Stores the Page access token and metadata needed
--      to call the Graph API. Encryption-at-rest is handled by Supabase
--      (pgsodium); we keep the token column NULLABLE so dev environments
--      without META_APP_ID configured can still load the page without
--      crashing.
--   2. public.social_post_publishes    — every publish attempt from
--      content_plan to a social_account, with the resulting external post
--      id + permalink + status.
--   3. public.social_post_metrics      — latest insights pulled from
--      Graph (impressions, reach, engagement, ...) for a publish row.
--
-- All three are tenant-scoped via business_id and follow the same RLS
-- model as the rest of the app:
--   - Tenants read/write only their own rows
--   - Platform admins (see migration 15) can read across tenants
--   - Service-role bypasses RLS for OAuth callbacks + metric ingestion
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. social_accounts
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.social_accounts (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  provider              text not null
                        check (provider in ('facebook', 'instagram')),
  -- External identifier from the provider:
  --   facebook  → Facebook Page ID
  --   instagram → Instagram Business Account ID
  external_id           text not null,
  name                  text not null,            -- Page / IG account display name
  username              text,                     -- @handle for IG; null for FB
  picture_url           text,
  -- Page access token (FB) or the Page token used to act on behalf of
  -- the linked IG Business account. Both Meta endpoints accept the
  -- Page token; we do not store IG-specific tokens separately.
  access_token          text,
  -- Long-lived Page tokens don't expire by Meta's docs, but we still
  -- track the issued_at so we can surface "issued X days ago" in the UI.
  token_issued_at       timestamptz,
  token_expires_at      timestamptz,
  scopes                text[] not null default '{}',
  status                text not null default 'active'
                        check (status in ('active', 'expired', 'disconnected')),
  -- For Instagram rows, the FB Page id that owns it. Helps us refresh
  -- the Page token in one place when it rotates.
  linked_fb_page_id     text,
  connected_by_user_id  uuid references public.users(id) on delete set null,
  connected_at          timestamptz not null default now(),
  last_synced_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (business_id, provider, external_id)
);

comment on table public.social_accounts is
  'Meta (Facebook Page / Instagram Business) accounts connected by a tenant. '
  'One row per Page or IG account. The access_token column holds the Page '
  'access token used to call the Graph API on the tenant''s behalf.';

create index if not exists social_accounts_business_idx
  on public.social_accounts (business_id, provider);
create index if not exists social_accounts_status_idx
  on public.social_accounts (status) where status = 'active';

alter table public.social_accounts enable row level security;

create policy social_accounts_tenant_select on public.social_accounts
  for select to authenticated
  using (
    business_id = public.current_business_id()
    or public.is_platform_admin()
  );

create policy social_accounts_tenant_modify on public.social_accounts
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. social_post_publishes
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.social_post_publishes (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  content_plan_id       uuid not null references public.content_plan(id) on delete cascade,
  social_account_id     uuid not null references public.social_accounts(id) on delete cascade,
  -- External post id from the provider (FB post id, IG media id).
  external_post_id      text,
  permalink             text,
  status                text not null default 'queued'
                        check (status in ('queued', 'posted', 'failed')),
  -- The exact caption + scheduled time we sent so we can show "what was
  -- published" even after the content_plan row is edited later.
  caption_snapshot      text,
  posted_at             timestamptz,
  error_message         text,
  created_by_user_id    uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.social_post_publishes is
  'Audit + tracking row for every attempt to publish a content_plan entry '
  'to a connected social_account. One row per (content_plan, account) try.';

create index if not exists social_post_publishes_business_idx
  on public.social_post_publishes (business_id, created_at desc);
create index if not exists social_post_publishes_plan_idx
  on public.social_post_publishes (content_plan_id);
create index if not exists social_post_publishes_account_idx
  on public.social_post_publishes (social_account_id, posted_at desc);

alter table public.social_post_publishes enable row level security;

create policy social_post_publishes_tenant_select on public.social_post_publishes
  for select to authenticated
  using (
    business_id = public.current_business_id()
    or public.is_platform_admin()
  );

create policy social_post_publishes_tenant_modify on public.social_post_publishes
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. social_post_metrics
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.social_post_metrics (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  publish_id            uuid not null references public.social_post_publishes(id) on delete cascade,
  impressions           integer not null default 0,
  reach                 integer not null default 0,
  engaged_users         integer not null default 0,
  likes                 integer not null default 0,
  comments              integer not null default 0,
  shares                integer not null default 0,
  saves                 integer not null default 0,
  video_views           integer not null default 0,
  raw_payload           jsonb,            -- the unparsed Graph insights blob
  fetched_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

comment on table public.social_post_metrics is
  'Snapshot of Graph API insights for a publish row. Re-fetched on demand '
  'from the Marketing → Content Detail → Insights tab.';

create index if not exists social_post_metrics_publish_idx
  on public.social_post_metrics (publish_id, fetched_at desc);

alter table public.social_post_metrics enable row level security;

create policy social_post_metrics_tenant_select on public.social_post_metrics
  for select to authenticated
  using (
    business_id = public.current_business_id()
    or public.is_platform_admin()
  );

create policy social_post_metrics_tenant_modify on public.social_post_metrics
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger (matches the convention used elsewhere)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public._touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_accounts_touch on public.social_accounts;
create trigger social_accounts_touch
  before update on public.social_accounts
  for each row execute function public._touch_updated_at();

drop trigger if exists social_post_publishes_touch on public.social_post_publishes;
create trigger social_post_publishes_touch
  before update on public.social_post_publishes
  for each row execute function public._touch_updated_at();
