-- ============================================================================
-- Bantu Niaga — Marketing pillar M4
-- ============================================================================
-- Phase 4 of the Marketing pillar — auto-segmentation tag refresh.
--
-- What lands here:
--   1. `public.marketing_compute_auto_tags(...)` — pure deterministic
--      SQL function returning the sorted text[] of auto-tags for a
--      given customer snapshot. Mirrors `lib/marketing/auto-tags.ts`
--      exactly. Defense-in-depth: any future SQL caller (RLS-aware
--      view, AI agent SQL prompt, etc.) gets the same answer as the
--      TS pipeline.
--   2. `public.marketing_apply_auto_tags(p_business_id)` — SECURITY
--      DEFINER per-business iterator. For each non-deleted,
--      non-merged customer in the business: computes the new tag
--      array, and if it differs from the stored value:
--        - UPDATE customers SET auto_tags = new_set, updated_at = now()
--        - INSERT customer_tag_history (prior_auto_tags, new_auto_tags, run_id)
--        - INSERT events_outbox row name='customer.tag_changed'
--      All three writes per moved customer happen in a single
--      Postgres statement-level transaction (the function body is
--      the txn). Returns aggregate counts.
--   3. `public.marketing_apply_auto_tags_all()` — iterates every
--      business and calls `marketing_apply_auto_tags`. Returns a
--      per-business breakdown so the Edge Function + backfill script
--      can log + return totals. Wraps each business call in its own
--      BEGIN/EXCEPTION block so a single business failure doesn't
--      poison the entire run.
--   4. Defensive indexes — `customers (business_id)` already exists
--      from M1, but we add a partial index on `(business_id)` filtered
--      by `deleted_at IS NULL AND merged_into_id IS NULL` so the M4
--      scan stays sequential within the live set.
--
-- Idempotency contract (plan §10.4):
--   - Running `marketing_apply_auto_tags_all` twice in a row produces
--     zero `customer.tag_changed` events on the second run, because
--     the diff check (`prior <> new`) short-circuits.
--
-- Thresholds (decisions Q1, hard-coded in v1):
--   new      ← last_purchase_at within last 30 days AND order_count <= 1
--   repeat   ← order_count >= 2
--   vip      ← total_spend_myr >= 1000 OR order_count >= 10
--   dormant  ← last_purchase_at older than 90 days
--   at-risk  ← (order_count >= 2 OR total_spend_myr >= 1000 OR
--              order_count >= 10) AND last_purchase_at in (60, 90] days
--
-- Schedule:
--   The Edge Function `marketing-tag-refresh` calls
--   `marketing_apply_auto_tags_all()` via HTTP POST. The recommended
--   wiring is `pg_cron` + `pg_net` invoking the function URL at
--   18:30 UTC daily (02:30 Asia/Kuala_Lumpur, per plan §6.1).
--   `pg_cron` and `pg_net` extensions are NOT enabled in this
--   project as of M4; the schedule SQL is shipped as a commented-out
--   block at the bottom of this migration and the user enables the
--   extensions via Supabase Dashboard → Database → Extensions, then
--   re-applies the block manually. See docs/plans/marketing-
--   implementation-plan.md §6.1 and the M4 hand-off.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_compute_auto_tags
--
-- Pure, deterministic compute. Marked IMMUTABLE on the visible inputs;
-- internally references `now()` (STABLE) so the wrapping function is
-- STABLE rather than truly IMMUTABLE.
-- Mirror of `computeAutoTags()` in lib/marketing/auto-tags.ts.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_compute_auto_tags(
  p_created_at        timestamptz,
  p_order_count       integer,
  p_total_spend       numeric,
  p_last_purchase_at  timestamptz
)
returns text[]
language plpgsql
stable
as $$
declare
  v_now           timestamptz := now();
  v_days_since    numeric;
  v_order_count   integer := coalesce(p_order_count, 0);
  v_total_spend   numeric := coalesce(p_total_spend, 0);
  v_tags          text[] := '{}'::text[];
  v_was_engaged   boolean;
begin
  if p_last_purchase_at is null then
    v_days_since := null;
  else
    v_days_since := extract(epoch from (v_now - p_last_purchase_at)) / 86400.0;
  end if;

  if v_order_count >= 2 then
    v_tags := array_append(v_tags, 'repeat');
  end if;

  if v_total_spend >= 1000 or v_order_count >= 10 then
    v_tags := array_append(v_tags, 'vip');
  end if;

  if v_days_since is not null and v_days_since > 90 then
    v_tags := array_append(v_tags, 'dormant');
  end if;

  v_was_engaged := (v_order_count >= 2) or (v_total_spend >= 1000) or (v_order_count >= 10);

  if v_was_engaged
     and v_days_since is not null
     and v_days_since > 60
     and v_days_since <= 90 then
    v_tags := array_append(v_tags, 'at-risk');
  end if;

  if v_days_since is not null
     and v_days_since < 30
     and v_order_count <= 1 then
    v_tags := array_append(v_tags, 'new');
  end if;

  -- Sort + dedup so callers can compare arrays element-wise vs the
  -- stored `customers.auto_tags` (also stored sorted).
  return (
    select coalesce(array_agg(distinct t order by t), '{}'::text[])
      from unnest(v_tags) as t
  );
end;
$$;

grant execute on function public.marketing_compute_auto_tags(
  timestamptz, integer, numeric, timestamptz
) to authenticated, service_role;

comment on function public.marketing_compute_auto_tags(
  timestamptz, integer, numeric, timestamptz
) is
  'Pure compute of the auto-tag set for a customer snapshot. Mirror of computeAutoTags() in lib/marketing/auto-tags.ts. Decisions Q1: thresholds hard-coded in v1.';

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_apply_auto_tags
--
-- Per-business iterator. Computes the new auto_tags array for every
-- live customer in the business; for customers whose new set differs
-- from the stored value, updates the customer + appends a history row
-- + emits a `customer.tag_changed` outbox event — all in a single
-- statement-level transaction.
--
-- Returns aggregate counts so the Edge Function + backfill script can
-- log them.
--
-- Runs as SECURITY DEFINER for two reasons:
--   1. The customer_tag_history table has no public INSERT policy;
--      only service_role or definers can append rows.
--   2. The events_outbox INSERT policy requires
--      `business_id = current_business_id()`. The backfill / Edge
--      Function callers have no JWT, so `current_business_id()`
--      returns NULL. Running as definer bypasses RLS; we still scope
--      every write to `p_business_id` so cross-tenant safety holds.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_apply_auto_tags(
  p_business_id uuid,
  p_run_id      uuid default gen_random_uuid()
)
returns table (
  updated_count     integer,
  transitions_count integer,
  run_id            uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer       record;
  v_new_tags       text[];
  v_prior_tags     text[];
  v_updated        integer := 0;
  v_transitions    integer := 0;
  v_now            timestamptz := now();
begin
  if p_business_id is null then
    raise exception 'p_business_id is required' using errcode = 'P0001';
  end if;

  for v_customer in
    select id, created_at, order_count, total_spend_myr,
           last_purchase_at, auto_tags
      from public.customers
     where business_id = p_business_id
       and deleted_at is null
       and merged_into_id is null
  loop
    v_new_tags := public.marketing_compute_auto_tags(
      v_customer.created_at,
      v_customer.order_count,
      v_customer.total_spend_myr,
      v_customer.last_purchase_at
    );
    v_prior_tags := coalesce(v_customer.auto_tags, '{}'::text[]);

    -- Element-wise array equality. Postgres' `=` on text[] is
    -- element-wise + position-aware, and both arrays are sorted, so
    -- this is a true set-equality check.
    if v_prior_tags is distinct from v_new_tags then
      update public.customers
         set auto_tags = v_new_tags,
             updated_at = v_now
       where id = v_customer.id
         and business_id = p_business_id;

      insert into public.customer_tag_history (
        business_id, customer_id, prior_auto_tags, new_auto_tags, computed_at, run_id
      ) values (
        p_business_id, v_customer.id, v_prior_tags, v_new_tags, v_now, p_run_id
      );

      insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
      values (
        p_business_id,
        'customer.tag_changed',
        jsonb_build_object(
          'customer_id',     v_customer.id,
          'prior_auto_tags', to_jsonb(v_prior_tags),
          'new_auto_tags',   to_jsonb(v_new_tags),
          'added',           to_jsonb(
            (select coalesce(array_agg(t order by t), '{}'::text[])
               from unnest(v_new_tags) as t
              where not (v_prior_tags @> array[t]))
          ),
          'removed',         to_jsonb(
            (select coalesce(array_agg(t order by t), '{}'::text[])
               from unnest(v_prior_tags) as t
              where not (v_new_tags @> array[t]))
          ),
          'computed_at',     v_now,
          'run_id',          p_run_id
        ),
        null
      );

      v_transitions := v_transitions + 1;
    end if;

    v_updated := v_updated + 1;
  end loop;

  return query select v_updated, v_transitions, p_run_id;
end;
$$;

grant execute on function public.marketing_apply_auto_tags(uuid, uuid)
  to authenticated, service_role;

comment on function public.marketing_apply_auto_tags(uuid, uuid) is
  'Per-business auto-tag refresh. SECURITY DEFINER. For each live customer, computes the new tag set, and on transition: UPDATE customer + INSERT history row + INSERT outbox row in one statement. Returns (updated_count, transitions_count, run_id).';

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_apply_auto_tags_all
--
-- Iterates every business and calls `marketing_apply_auto_tags` for
-- each. Each business call runs in its own sub-block so a single
-- business failure doesn't kill the entire run; failures are reported
-- in the return set with NULL counts + the error message.
--
-- The Edge Function and backfill script call this directly.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_apply_auto_tags_all(
  p_run_id uuid default gen_random_uuid()
)
returns table (
  business_id        uuid,
  updated_count      integer,
  transitions_count  integer,
  error_message      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz       record;
  v_updated   integer;
  v_trans     integer;
  v_err       text;
begin
  for v_biz in
    select id
      from public.businesses
     order by id
  loop
    v_err := null;
    v_updated := null;
    v_trans := null;
    begin
      select t.updated_count, t.transitions_count
        into v_updated, v_trans
        from public.marketing_apply_auto_tags(v_biz.id, p_run_id) as t;
    exception when others then
      v_err := sqlerrm;
    end;

    business_id := v_biz.id;
    updated_count := v_updated;
    transitions_count := v_trans;
    error_message := v_err;
    return next;
  end loop;
end;
$$;

grant execute on function public.marketing_apply_auto_tags_all(uuid)
  to authenticated, service_role;

comment on function public.marketing_apply_auto_tags_all(uuid) is
  'Top-level entry point for the nightly tag refresh. Iterates businesses; per-business failures are isolated and surfaced in the return set rather than aborting the whole run.';

-- ─────────────────────────────────────────────────────────────────────────
-- Index — fast scan over the live customer set per business.
--
-- The M1 migration already has `customers_business_idx` on
-- `(business_id)`. The M4 scan additionally filters by
-- `deleted_at IS NULL AND merged_into_id IS NULL`. A partial index on
-- the same key lets Postgres skip tombstoned + merged rows during the
-- nightly walk.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists customers_business_live_idx
  on public.customers (business_id, id)
  where deleted_at is null and merged_into_id is null;

-- ─────────────────────────────────────────────────────────────────────────
-- Schedule wiring (DEFERRED — extensions not enabled in baseline).
--
-- The M4 milestone ships the Edge Function + this SQL. The pg_cron
-- schedule that invokes the Edge Function via HTTP is documented here
-- but commented out; enabling it requires:
--
--   1. Supabase Dashboard → Database → Extensions: enable `pg_cron`
--      and `pg_net`.
--   2. supabase functions deploy marketing-tag-refresh
--   3. supabase secrets set TAG_REFRESH_SHARED_SECRET=...
--   4. Run the block below (manually, or as a follow-up migration).
--
-- The function still works without the schedule — the backfill script
-- `npm run backfill:auto-tags` and a manual `curl` to the Edge Function
-- both call `marketing_apply_auto_tags_all` directly.
--
-- ─────────────────────────────────────────────────────────────────────────
--
-- -- 18:30 UTC daily = 02:30 Asia/Kuala_Lumpur next day (plan §6.1).
-- select cron.schedule(
--   'marketing-tag-refresh-nightly',
--   '30 18 * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://fqogcxmzgcvlqkbxszrg.supabase.co/functions/v1/marketing-tag-refresh',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'X-Tag-Refresh-Secret', current_setting('app.tag_refresh_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
