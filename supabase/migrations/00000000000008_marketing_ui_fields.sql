-- ============================================================================
-- Bantu Niaga — Marketing UI alignment (engagement + hashtags)
-- ============================================================================
-- Adds the fields surfaced by the Pencil designs that did not previously
-- exist in the schema:
--
--   1. content_plan.hashtags         text[] not null default '{}'
--   2. content_plan.views            integer not null default 0
--   3. content_plan.likes            integer not null default 0
--   4. content_plan.comments_count   integer not null default 0
--   5. content_plan.shares           integer not null default 0
--   6. content_plan.saves            integer not null default 0
--   7. content_plan.forecast_reach_min / forecast_reach_max — nullable
--      integers used by the Maya forecast card on the Content Detail page
--      (filled by the agent later; nullable until then).
--
-- Engagement counters default to 0 so the "Performance" section on the
-- Content Detail page can render zeros instead of "—" before any post
-- goes live. They're updated by the platform webhook listener (separate
-- pillar, lands in M7+). Until then they stay at zero, which matches
-- the "Available once the post is live" copy.
-- ============================================================================

alter table public.content_plan
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists views integer not null default 0,
  add column if not exists likes integer not null default 0,
  add column if not exists comments_count integer not null default 0,
  add column if not exists shares integer not null default 0,
  add column if not exists saves integer not null default 0,
  add column if not exists forecast_reach_min integer,
  add column if not exists forecast_reach_max integer;

-- Per-element guard for hashtags: up to 30 tags, each ≤ 60 chars, must
-- start with '#'. Mirrors the manual_tags pattern in M1.
create or replace function public.content_hashtags_ok(tags text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    (
      select bool_and(
        length(t) between 2 and 60
        and t like '#%'
        and t not like '% %'
      )
      from unnest(tags) as t
    ),
    true
  );
$$;

alter table public.content_plan
  drop constraint if exists content_plan_hashtags_cap;
alter table public.content_plan
  add constraint content_plan_hashtags_cap
    check (array_length(hashtags, 1) is null or array_length(hashtags, 1) <= 30);

alter table public.content_plan
  drop constraint if exists content_plan_hashtags_shape;
alter table public.content_plan
  add constraint content_plan_hashtags_shape
    check (public.content_hashtags_ok(hashtags));

-- Engagement counters are unsigned: non-negative integers only.
alter table public.content_plan
  drop constraint if exists content_plan_engagement_nonneg;
alter table public.content_plan
  add constraint content_plan_engagement_nonneg
    check (
      views >= 0
      and likes >= 0
      and comments_count >= 0
      and shares >= 0
      and saves >= 0
    );

-- Forecast bounds are nullable, but if both present min <= max.
alter table public.content_plan
  drop constraint if exists content_plan_forecast_order;
alter table public.content_plan
  add constraint content_plan_forecast_order
    check (
      forecast_reach_min is null
      or forecast_reach_max is null
      or forecast_reach_min <= forecast_reach_max
    );

-- GIN index on hashtags so the Channel performance card can run
-- `where hashtags && ARRAY['#raya']` style queries cheaply once the
-- Marketing AI lands.
create index if not exists content_plan_hashtags_idx
  on public.content_plan using gin (hashtags);

-- B-tree on views to support "Top performing content" leaderboard order.
create index if not exists content_plan_business_views_idx
  on public.content_plan (business_id, views desc)
  where status = 'posted';

comment on column public.content_plan.hashtags is
  'Separately tracked hashtags (no leading "#" required in API input; the API normalises). Pencil UI renders these as chips beside the caption.';
comment on column public.content_plan.views is
  'Lifetime view count from the channel''s public-engagement webhook. 0 until the channel listener fires.';
comment on column public.content_plan.forecast_reach_min is
  'Lower bound of the Maya AI reach forecast surfaced on the Content Detail page. NULL until the agent has enough history.';
