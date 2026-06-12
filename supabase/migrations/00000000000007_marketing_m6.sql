-- ============================================================================
-- Bantu Niaga — Marketing pillar M6
-- ============================================================================
-- Phase 6 of the Marketing pillar — cross-pillar event listeners that
-- keep customer purchase metrics fresh, plus a per-business analytics
-- aggregate for the /marketing KPI cards.
--
-- What lands here:
--   1. ALTER marketing_event_dedup — add event_name, business_id,
--      outcome, error_message, linked_invoice_id columns + indexes.
--      The base table was created in M1 with only (event_id pk,
--      processed_at) — we extend it in-place rather than replacing it.
--
--   2. public.marketing_apply_metric_event(p_event_id uuid)
--      SECURITY DEFINER. Reads a single events_outbox row, resolves the
--      customer (chasing one merge hop), verifies tenant scoping,
--      applies the metric update + dedup insert + (for analytics
--      visibility) emits a `customer.updated` outbox event — all in
--      one transaction (function body == txn). Returns the outcome.
--
--      Idempotency: if the event_id already lives in
--      marketing_event_dedup, returns `skipped_already_processed`
--      without touching customers.
--
--      Cross-business: if payload.business_id is present and differs
--      from events_outbox.business_id, OR if the resolved customer's
--      business_id differs from the event's business_id, the listener
--      logs `skipped_cross_business` in dedup and does nothing else.
--
--      Soft-deleted customer: the metric update still applies. A
--      customer that was soft-deleted between transaction commit on
--      the source pillar and dispatch on Marketing's side can still
--      receive a delayed event — applying it is purely bookkeeping
--      (Marketing's list/search views already hide deleted_at IS NOT
--      NULL rows, so the operator never sees the bumped metric).
--
--      Merged customer: single-hop redirect to merged_into_id. v1
--      merge depth is shallow (Marketing's merge endpoint is the only
--      writer), so one hop is sufficient.
--
--   3. public.marketing_apply_metric_events_batch(p_limit int)
--      Batch driver for the local Edge Function poller / smoke script
--      / pg_cron schedule. Selects up to p_limit oldest unprocessed
--      events_outbox rows for the 4 event names Marketing consumes
--      and runs the single-event RPC for each. Per-event errors are
--      captured into dedup as `error` outcome — they do not abort the
--      batch.
--
--   4. public.customer_analytics_v1 view — aggregates per-business
--      segment counts for the /marketing landing KPI cards and the
--      future Marketing AI agent. Filters out merged + soft-deleted.
--
--   5. Indexes on events_outbox for fast batch polling of the 4
--      Marketing-consumed event names.
--
-- Dispatcher gap (decisions Q4):
--   The plan calls for a global events_outbox dispatcher (dependency
--   D8) that calls per-pillar handlers. That dispatcher does not
--   exist yet (other dev). Until it lands, Marketing owns a LOCAL
--   poller — the Edge Function `marketing-event-listener` — that
--   invokes `marketing_apply_metric_events_batch` on a schedule (or
--   on-demand via the operator). When D8 ships, the per-event RPC is
--   dispatcher-agnostic and can be wired directly from the global
--   dispatcher; the local poller is retired.
--
-- Real-event source gap (plan §3.3 D1–D4):
--   Finance must add `invoices.customer_id` and `customer_id` to
--   `InvoicePaidPayload`; Operations must define `OrderDeliveredPayload`
--   and `BookingCompletedPayload` per plan §3.2.2 / §3.2.3. Until
--   those pillars ship, M6 will see zero real events. The
--   infrastructure (this migration + the Edge Function + the KPI
--   cards) is independently shippable and tested against synthetic
--   `events_outbox` rows.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- marketing_event_dedup — extend with outcome tracking columns.
-- The base table is from M1 (assumption #11): (event_id pk, processed_at).
-- Add columns are nullable + idempotent so M6 can re-run safely.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.marketing_event_dedup
  add column if not exists event_name text;
alter table public.marketing_event_dedup
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.marketing_event_dedup
  add column if not exists outcome text;
alter table public.marketing_event_dedup
  add column if not exists error_message text;
alter table public.marketing_event_dedup
  add column if not exists linked_invoice_id uuid;
alter table public.marketing_event_dedup
  add column if not exists linked_customer_id uuid;

-- CHECK constraint on outcome — drop+recreate so re-runs of this
-- migration replace the constraint cleanly.
alter table public.marketing_event_dedup
  drop constraint if exists marketing_event_dedup_outcome_check;
alter table public.marketing_event_dedup
  add constraint marketing_event_dedup_outcome_check
  check (
    outcome is null
    or outcome in (
      'applied',
      'skipped_cross_business',
      'skipped_no_customer',
      'skipped_already_processed',
      'skipped_no_event',
      'skipped_unsupported_event',
      'error'
    )
  );

create index if not exists marketing_event_dedup_name_time_idx
  on public.marketing_event_dedup (event_name, processed_at desc);

create index if not exists marketing_event_dedup_business_idx
  on public.marketing_event_dedup (business_id, processed_at desc);

create index if not exists marketing_event_dedup_linked_invoice_idx
  on public.marketing_event_dedup (linked_invoice_id)
  where linked_invoice_id is not null and outcome = 'applied';

comment on table public.marketing_event_dedup is
  'M6 idempotency ledger for cross-pillar metric event listeners. One row per processed events_outbox.id. Outcome=applied is a true metric update; skipped_* rows record events deliberately ignored (cross-business, missing customer, already-processed, unsupported event); error rows capture failures for operator review.';

-- ─────────────────────────────────────────────────────────────────────────
-- events_outbox — partial indexes for fast batch polling of Marketing-
-- consumed event names. The init migration already has
-- `events_outbox_undispatched_idx` keyed on emitted_at where
-- dispatched_at is null; M6 adds a name-filtered index so the batch
-- poller doesn't scan the whole outbox in business with chatty
-- non-Marketing events.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists events_outbox_marketing_metric_idx
  on public.events_outbox (emitted_at)
  where name in (
    'invoice.paid',
    'order.delivered',
    'booking.completed',
    'lead.converted'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_resolve_customer_target
--
-- Single-hop merge chaser. Given a customer_id, returns either the same
-- id (if not merged) or its merged_into_id (if merged once). Plan §4.2.5
-- says merge is shallow in v1, so one hop is sufficient.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_resolve_customer_target(
  p_customer_id uuid
)
returns table (
  id          uuid,
  business_id uuid,
  deleted_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_id            uuid;
  v_business_id   uuid;
  v_merged_into   uuid;
  v_deleted_at    timestamptz;
begin
  if p_customer_id is null then
    return;
  end if;

  select c.id, c.business_id, c.merged_into_id, c.deleted_at
    into v_id, v_business_id, v_merged_into, v_deleted_at
    from public.customers c
    where c.id = p_customer_id;

  if v_id is null then
    return;
  end if;

  if v_merged_into is not null then
    select c.id, c.business_id, c.deleted_at
      into v_id, v_business_id, v_deleted_at
      from public.customers c
      where c.id = v_merged_into;

    if v_id is null then
      return;
    end if;
  end if;

  id := v_id;
  business_id := v_business_id;
  deleted_at := v_deleted_at;
  return next;
end;
$$;

grant execute on function public.marketing_resolve_customer_target(uuid)
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_apply_metric_event
--
-- Process a single events_outbox row identified by `p_event_id`.
-- SECURITY DEFINER so the local poller / Edge Function (no JWT) can
-- bypass RLS while we explicitly scope every write to the resolved
-- business_id. Returns one row describing the outcome.
--
-- Atomic: the metric UPDATE + dedup INSERT + (optional)
-- `customer.updated` outbox emission all run in one statement-level
-- transaction (the function body). Either all succeed or all roll back.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_apply_metric_event(
  p_event_id uuid
)
returns table (
  outcome     text,
  applied     boolean,
  customer_id uuid,
  business_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_event        record;
  v_payload      jsonb;
  v_event_name   text;
  v_event_biz    uuid;
  v_payload_biz  uuid;
  v_raw_cust_id  uuid;
  v_target       record;
  v_total        numeric(12, 2);
  v_purchase_at  timestamptz;
  v_invoice_id   uuid;
  v_invoice_dup  boolean;
  v_existing     record;
  v_lead_id      uuid;
  v_outcome      text;
  v_err          text;
begin
  if p_event_id is null then
    raise exception 'marketing_apply_metric_event: p_event_id is required'
      using errcode = 'P0001';
  end if;

  -- Already processed? Short-circuit. This is the idempotency core.
  select d.event_id, d.outcome, d.business_id
    into v_existing
    from public.marketing_event_dedup d
    where d.event_id = p_event_id;

  if found then
    outcome := 'skipped_already_processed';
    applied := false;
    customer_id := null;
    business_id := v_existing.business_id;
    return next;
    return;
  end if;

  -- Load the outbox row. If missing, dedup as `skipped_no_event`.
  select e.id, e.name, e.payload, e.business_id
    into v_event
    from public.events_outbox e
    where e.id = p_event_id;

  if not found then
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome, error_message
    ) values (
      p_event_id, now(), null, null, 'skipped_no_event',
      'events_outbox row not found for the given event_id'
    );

    outcome := 'skipped_no_event';
    applied := false;
    customer_id := null;
    business_id := null;
    return next;
    return;
  end if;

  v_event_name := v_event.name;
  v_payload    := coalesce(v_event.payload, '{}'::jsonb);
  v_event_biz  := v_event.business_id;

  -- Only the 4 metric events. Any other event name → log and skip.
  if v_event_name not in (
    'invoice.paid',
    'order.delivered',
    'booking.completed',
    'lead.converted'
  ) then
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome, error_message
    ) values (
      p_event_id, now(), v_event_name, v_event_biz, 'skipped_unsupported_event',
      format('event name %s is not a Marketing-consumed metric event', v_event_name)
    );

    outcome := 'skipped_unsupported_event';
    applied := false;
    customer_id := null;
    business_id := v_event_biz;
    return next;
    return;
  end if;

  -- Cross-business early check: if the payload claims a different
  -- business_id than the outbox row, refuse and dedup.
  v_payload_biz := nullif(v_payload ->> 'business_id', '')::uuid;
  if v_payload_biz is not null and v_payload_biz <> v_event_biz then
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome, error_message
    ) values (
      p_event_id, now(), v_event_name, v_event_biz, 'skipped_cross_business',
      format(
        'payload.business_id %s disagrees with events_outbox.business_id %s',
        v_payload_biz, v_event_biz
      )
    );

    outcome := 'skipped_cross_business';
    applied := false;
    customer_id := null;
    business_id := v_event_biz;
    return next;
    return;
  end if;

  -- Extract the customer_id from payload. Each event has its own field
  -- name but the canonical contract is `customer_id` across all 4.
  v_raw_cust_id := nullif(v_payload ->> 'customer_id', '')::uuid;

  if v_raw_cust_id is null then
    -- For lead.converted with no customer_id yet, this is a legit
    -- skip (Sales convert flow has not finished writing the link).
    -- For the metric events it's a data-drift skip; either way we
    -- record it and stop.
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome, error_message
    ) values (
      p_event_id, now(), v_event_name, v_event_biz, 'skipped_no_customer',
      'payload has no customer_id; nothing to route the metric to'
    );

    outcome := 'skipped_no_customer';
    applied := false;
    customer_id := null;
    business_id := v_event_biz;
    return next;
    return;
  end if;

  -- Resolve merge target (one hop).
  select t.id, t.business_id, t.deleted_at
    into v_target
    from public.marketing_resolve_customer_target(v_raw_cust_id) as t;

  if not found or v_target.id is null then
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome,
      error_message, linked_customer_id
    ) values (
      p_event_id, now(), v_event_name, v_event_biz, 'skipped_no_customer',
      format('customer %s not found (post-merge resolution)', v_raw_cust_id),
      v_raw_cust_id
    );

    outcome := 'skipped_no_customer';
    applied := false;
    customer_id := v_raw_cust_id;
    business_id := v_event_biz;
    return next;
    return;
  end if;

  -- Tenant scoping: resolved customer must live in the event's business.
  if v_target.business_id <> v_event_biz then
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome,
      error_message, linked_customer_id
    ) values (
      p_event_id, now(), v_event_name, v_event_biz, 'skipped_cross_business',
      format(
        'resolved customer business %s != event business %s',
        v_target.business_id, v_event_biz
      ),
      v_target.id
    );

    outcome := 'skipped_cross_business';
    applied := false;
    customer_id := v_target.id;
    business_id := v_event_biz;
    return next;
    return;
  end if;

  -- ── Event-specific metric update ─────────────────────────────────────
  v_invoice_id  := nullif(v_payload ->> 'invoice_id', '')::uuid;
  v_invoice_dup := false;

  if v_event_name = 'invoice.paid' then
    -- Required fields: total_myr, paid_at.
    v_total := nullif(v_payload ->> 'total_myr', '')::numeric;
    v_purchase_at := nullif(v_payload ->> 'paid_at', '')::timestamptz;

    update public.customers as c
       set total_spend_myr  = c.total_spend_myr + coalesce(v_total, 0),
           order_count      = c.order_count + 1,
           last_purchase_at = greatest(
             coalesce(c.last_purchase_at, v_purchase_at, now()),
             coalesce(v_purchase_at, now())
           ),
           updated_at = now()
     where c.id = v_target.id
       and c.business_id = v_event_biz;

    v_outcome := 'applied';

  elsif v_event_name = 'order.delivered' then
    v_total := nullif(v_payload ->> 'total_myr', '')::numeric;
    v_purchase_at := nullif(v_payload ->> 'delivered_at', '')::timestamptz;

    -- Look-aside: if this order has an associated invoice that
    -- Marketing already processed, skip to avoid double-counting.
    if v_invoice_id is not null then
      select true into v_invoice_dup
        from public.marketing_event_dedup d
        where d.linked_invoice_id = v_invoice_id
          and d.business_id = v_event_biz
          and d.outcome = 'applied'
        limit 1;

      if v_invoice_dup then
        insert into public.marketing_event_dedup (
          event_id, processed_at, event_name, business_id, outcome,
          error_message, linked_customer_id, linked_invoice_id
        ) values (
          p_event_id, now(), v_event_name, v_event_biz, 'skipped_already_processed',
          format(
            'invoice %s already produced an applied metric update; skipping order.delivered to avoid double-count',
            v_invoice_id
          ),
          v_target.id, v_invoice_id
        );

        outcome := 'skipped_already_processed';
        applied := false;
        customer_id := v_target.id;
        business_id := v_event_biz;
        return next;
        return;
      end if;
    end if;

    update public.customers as c
       set total_spend_myr  = c.total_spend_myr + coalesce(v_total, 0),
           order_count      = c.order_count + 1,
           last_purchase_at = greatest(
             coalesce(c.last_purchase_at, v_purchase_at, now()),
             coalesce(v_purchase_at, now())
           ),
           updated_at = now()
     where c.id = v_target.id
       and c.business_id = v_event_biz;

    v_outcome := 'applied';

  elsif v_event_name = 'booking.completed' then
    v_total := nullif(v_payload ->> 'service_total_myr', '')::numeric;
    v_purchase_at := nullif(v_payload ->> 'completed_at', '')::timestamptz;

    if v_invoice_id is not null then
      select true into v_invoice_dup
        from public.marketing_event_dedup d
        where d.linked_invoice_id = v_invoice_id
          and d.business_id = v_event_biz
          and d.outcome = 'applied'
        limit 1;

      if v_invoice_dup then
        insert into public.marketing_event_dedup (
          event_id, processed_at, event_name, business_id, outcome,
          error_message, linked_customer_id, linked_invoice_id
        ) values (
          p_event_id, now(), v_event_name, v_event_biz, 'skipped_already_processed',
          format(
            'invoice %s already produced an applied metric update; skipping booking.completed to avoid double-count',
            v_invoice_id
          ),
          v_target.id, v_invoice_id
        );

        outcome := 'skipped_already_processed';
        applied := false;
        customer_id := v_target.id;
        business_id := v_event_biz;
        return next;
        return;
      end if;
    end if;

    update public.customers as c
       set total_spend_myr  = c.total_spend_myr + coalesce(v_total, 0),
           order_count      = c.order_count + 1,
           last_purchase_at = greatest(
             coalesce(c.last_purchase_at, v_purchase_at, now()),
             coalesce(v_purchase_at, now())
           ),
           updated_at = now()
     where c.id = v_target.id
       and c.business_id = v_event_biz;

    v_outcome := 'applied';

  elsif v_event_name = 'lead.converted' then
    -- Plan §3.2.4: lead.converted is informational for Marketing.
    -- The customer record was already created by Sales via the
    -- `POST /api/marketing/customers` synchronous handshake (D5).
    -- Marketing's listener bumps `updated_at` so downstream consumers
    -- of `customer.updated` (audit feed, future AI agent) see the
    -- lead conversion as a lifecycle event, but does NOT mutate
    -- purchase metrics — no purchase has happened yet at conversion.
    v_lead_id := nullif(v_payload ->> 'lead_id', '')::uuid;

    update public.customers as c
       set updated_at = now()
     where c.id = v_target.id
       and c.business_id = v_event_biz;

    v_outcome := 'applied';
  end if;

  -- Record success in dedup.
  insert into public.marketing_event_dedup (
    event_id, processed_at, event_name, business_id, outcome, error_message,
    linked_customer_id, linked_invoice_id
  ) values (
    p_event_id, now(), v_event_name, v_event_biz, v_outcome, null,
    v_target.id, v_invoice_id
  );

  -- Optional: emit `customer.updated` so downstream consumers (Admin
  -- audit feed, future AI agent) see the metric change. Cheap; the
  -- transactional-outbox guarantee means it lands iff the metric
  -- update committed.
  insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
  values (
    v_event_biz,
    'customer.updated',
    jsonb_build_object(
      'customer_id',     v_target.id,
      'changed_fields',  to_jsonb(array['total_spend_myr','order_count','last_purchase_at']::text[]),
      'actor_user_id',   null,
      'source_event_id', p_event_id,
      'source_event_name', v_event_name
    ),
    null
  );

  outcome := v_outcome;
  applied := (v_outcome = 'applied');
  customer_id := v_target.id;
  business_id := v_event_biz;
  return next;
  return;

exception when others then
  v_err := sqlerrm;
  -- Best-effort: try to log the error to dedup so the operator can
  -- triage. Wrap in a sub-block so a dedup write failure doesn't
  -- mask the original exception.
  begin
    insert into public.marketing_event_dedup (
      event_id, processed_at, event_name, business_id, outcome, error_message
    ) values (
      p_event_id, now(),
      coalesce(v_event_name, null),
      coalesce(v_event_biz, null),
      'error', v_err
    )
    on conflict (event_id) do nothing;
  exception when others then
    null;
  end;
  raise;
end;
$$;

grant execute on function public.marketing_apply_metric_event(uuid)
  to authenticated, service_role;

comment on function public.marketing_apply_metric_event(uuid) is
  'M6 single-event metric listener. SECURITY DEFINER. Reads events_outbox row, resolves merged customer (1 hop), verifies tenant scope, applies the metric update + dedup row + customer.updated outbox emission in one transaction. Idempotent on event_id.';

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_apply_metric_events_batch
--
-- Batch driver. Selects up to p_limit unprocessed events_outbox rows
-- (oldest first) for the 4 Marketing-consumed names, then calls
-- marketing_apply_metric_event for each. Per-event exceptions are
-- caught and reported as a row with outcome='error' so a single bad
-- event doesn't poison the batch.
--
-- Called by:
--   - supabase/functions/marketing-event-listener (HTTP wrapper)
--   - scripts/backfill-marketing-events.ts (operator one-shot)
--   - scripts/smoke-m6.ts (integration smoke)
--   - eventually: the Phase 0 global dispatcher (when D8 lands)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_apply_metric_events_batch(
  p_limit integer default 100
)
returns table (
  event_id   uuid,
  event_name text,
  outcome    text,
  applied    boolean,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row       record;
  v_result    record;
  v_err       text;
begin
  if p_limit is null or p_limit < 1 then
    p_limit := 100;
  end if;

  for v_row in
    select e.id, e.name
      from public.events_outbox e
      where e.name in (
        'invoice.paid',
        'order.delivered',
        'booking.completed',
        'lead.converted'
      )
        and not exists (
          select 1
            from public.marketing_event_dedup d
            where d.event_id = e.id
        )
      order by e.emitted_at asc, e.id asc
      limit p_limit
  loop
    v_err := null;

    begin
      select t.outcome, t.applied
        into v_result
        from public.marketing_apply_metric_event(v_row.id) as t;
    exception when others then
      v_err := sqlerrm;
    end;

    event_id := v_row.id;
    event_name := v_row.name;
    if v_err is null then
      outcome := v_result.outcome;
      applied := coalesce(v_result.applied, false);
      error_message := null;
    else
      outcome := 'error';
      applied := false;
      error_message := v_err;
    end if;
    return next;
  end loop;
end;
$$;

grant execute on function public.marketing_apply_metric_events_batch(integer)
  to authenticated, service_role;

comment on function public.marketing_apply_metric_events_batch(integer) is
  'M6 batch driver. Pulls up to p_limit unprocessed Marketing-consumed events from events_outbox and invokes the per-event RPC for each. Per-event errors surface as rows with outcome=error rather than aborting the whole batch.';

-- ─────────────────────────────────────────────────────────────────────────
-- customer_analytics_v1 — per-business aggregation feeding the
-- /marketing landing KPI cards. Filters out merged + soft-deleted.
--
-- Plan §11 M6 mentions this as an optional but useful artefact for the
-- future Marketing AI agent. The /marketing page reads it via a single
-- SELECT scoped to the caller's business_id.
-- ─────────────────────────────────────────────────────────────────────────
create or replace view public.customer_analytics_v1 as
select
  c.business_id,
  count(*)                                                       as total_customers,
  count(*) filter (
    where c.created_at >= date_trunc('month', now())
  )                                                              as new_this_month,
  count(*) filter (where 'vip'     = any(c.auto_tags))           as vip_count,
  count(*) filter (where 'dormant' = any(c.auto_tags))           as dormant_count,
  count(*) filter (where 'at-risk' = any(c.auto_tags))           as at_risk_count,
  count(*) filter (where 'repeat'  = any(c.auto_tags))           as repeat_count,
  count(*) filter (where 'new'     = any(c.auto_tags))           as new_count,
  coalesce(sum(c.total_spend_myr), 0)::numeric(14, 2)            as total_spend_myr_sum,
  coalesce(avg(c.aov_myr) filter (where c.order_count > 0), 0)::numeric(12, 2)
                                                                 as avg_aov_myr
from public.customers c
where c.deleted_at is null
  and c.merged_into_id is null
group by c.business_id;

comment on view public.customer_analytics_v1 is
  'M6 per-business segment counts for the /marketing landing KPI cards. Filters out merged + soft-deleted customers. RLS on the underlying customers table scopes the SELECT to the caller business.';

grant select on public.customer_analytics_v1 to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_kpi_snapshot(p_business_id uuid)
--
-- Helper RPC that returns the M6 KPI card numbers for a single
-- business without exposing the cross-tenant view to authenticated
-- callers. SECURITY DEFINER + explicit business_id filter keeps the
-- read safe; callers verify p_business_id matches their own
-- current_business_id() before invoking.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_kpi_snapshot(
  p_business_id uuid
)
returns table (
  total_customers     bigint,
  new_this_month      bigint,
  vip_count           bigint,
  dormant_count       bigint,
  at_risk_count       bigint,
  repeat_count        bigint,
  new_count           bigint,
  total_spend_myr_sum numeric,
  avg_aov_myr         numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(v.total_customers,     0)::bigint  as total_customers,
    coalesce(v.new_this_month,      0)::bigint  as new_this_month,
    coalesce(v.vip_count,           0)::bigint  as vip_count,
    coalesce(v.dormant_count,       0)::bigint  as dormant_count,
    coalesce(v.at_risk_count,       0)::bigint  as at_risk_count,
    coalesce(v.repeat_count,        0)::bigint  as repeat_count,
    coalesce(v.new_count,           0)::bigint  as new_count,
    coalesce(v.total_spend_myr_sum, 0)::numeric as total_spend_myr_sum,
    coalesce(v.avg_aov_myr,         0)::numeric as avg_aov_myr
  from (
    select 1 as _present
  ) anchor
  left join public.customer_analytics_v1 v
    on v.business_id = p_business_id;
$$;

grant execute on function public.marketing_kpi_snapshot(uuid)
  to authenticated, service_role;

comment on function public.marketing_kpi_snapshot(uuid) is
  'M6 KPI snapshot for a single business. Returns zero-row defaults when the business has no live customers yet (the LEFT JOIN trick keeps the 5 KPI cards rendering 0/0/0/0/0 instead of an empty row).';
