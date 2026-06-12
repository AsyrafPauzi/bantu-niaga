-- ============================================================================
-- Bantu Niaga — Marketing pillar M2
-- ============================================================================
-- Phase 2 of the Marketing pillar — CRM list / detail / merge / soft-delete.
--
-- What lands here:
--   1. `public.marketing_update_customer(...)` — atomic UPDATE + emit
--      `customer.updated` outbox row in the same transaction.
--   2. `public.marketing_soft_delete_customer(...)` — set `deleted_at` and
--      emit `customer.deleted` outbox row in the same transaction.
--   3. `public.marketing_merge_customers(...)` — full merge transaction:
--        - assert same business
--        - 409-equivalent error if loser already merged
--        - copy non-null fields from loser into winner where winner is empty;
--          notes append, manual_tags union, phone keep winner's
--        - re-point every FK registered in `customer_external_refs`
--        - tombstone the loser: merged_into_id = winner_id, deleted_at = now()
--        - emit one `customer.merged` outbox row
--      Runs as SECURITY DEFINER because the FK re-pointing has to touch
--      downstream tables (invoices, orders, bookings, leads, ...) that the
--      calling Marketing operator's RLS does NOT directly cover. The
--      function still tenant-scopes every UPDATE with `business_id = $1`.
--   4. `public.customers_update_self_business_soft_delete` policy update —
--      allow operators to also UPDATE rows where they are setting
--      `deleted_at` (the M1 update policy is fine; we just need a
--      reminder that PATCH writes go through the same policy).
--
-- All RPCs return either a discriminated result row or raise an exception
-- carrying a SQLSTATE the API layer maps to a HTTP code:
--   'P0001'                              → 409 / 400 (custom messages)
--   'check_violation' / 'foreign_key…'   → 400
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_update_customer
--
-- Atomic UPDATE of a customer row + emission of the matching
-- `customer.updated` outbox event in the same Postgres transaction.
--
-- The set of fields the caller is allowed to write is controlled by the
-- API layer (desktop = full, mobile = notes / manual_tags / phone). This
-- RPC trusts the inputs it receives; pass `null` for "do not change".
--
-- Returns the updated row's id + the emitted outbox event id. Raises
-- `P0001` "not_found" if no row matches (id × business_id × not deleted
-- × not merged).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_update_customer(
  p_business_id        uuid,
  p_customer_id        uuid,
  p_name               text,
  p_phone_e164         text,
  p_email              text,
  p_address            text,
  p_manual_tags        text[],
  p_notes              text,
  p_changed_fields     text[],
  p_actor_user_id      uuid,
  p_set_phone          boolean,
  p_set_email          boolean,
  p_set_address        boolean,
  p_set_notes          boolean,
  p_set_name           boolean,
  p_set_manual_tags    boolean
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
  update public.customers c
     set name        = case when p_set_name        then p_name        else c.name        end,
         phone_e164  = case when p_set_phone       then p_phone_e164  else c.phone_e164  end,
         email       = case when p_set_email       then p_email       else c.email       end,
         address     = case when p_set_address     then p_address     else c.address     end,
         manual_tags = case when p_set_manual_tags then coalesce(p_manual_tags, '{}'::text[]) else c.manual_tags end,
         notes       = case when p_set_notes       then p_notes       else c.notes       end
   where c.id = p_customer_id
     and c.business_id = p_business_id
     and c.deleted_at is null
     and c.merged_into_id is null
  returning c.id into v_customer_id;

  if v_customer_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Only emit when at least one field was actually changed.
  if array_length(p_changed_fields, 1) > 0 then
    insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
    values (
      p_business_id,
      'customer.updated',
      jsonb_build_object(
        'customer_id',    v_customer_id,
        'changed_fields', to_jsonb(p_changed_fields),
        'actor_user_id',  p_actor_user_id
      ),
      p_actor_user_id
    )
    returning id into v_event_id;
  end if;

  return query
    select v_customer_id as customer_id,
           v_event_id    as event_id;
end;
$$;

grant execute on function public.marketing_update_customer(
  uuid, uuid, text, text, text, text, text[], text,
  text[], uuid,
  boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_soft_delete_customer
--
-- Sets `deleted_at = now()` on the customer row (idempotent: re-deleting
-- a tombstoned row is a no-op, no second outbox event) AND emits one
-- `customer.deleted` outbox event.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_soft_delete_customer(
  p_business_id        uuid,
  p_customer_id        uuid,
  p_actor_user_id      uuid
)
returns table (
  customer_id uuid,
  event_id    uuid,
  deleted_at  timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_event_id    uuid;
  v_deleted_at  timestamptz;
begin
  update public.customers c
     set deleted_at = now()
   where c.id = p_customer_id
     and c.business_id = p_business_id
     and c.deleted_at is null
     and c.merged_into_id is null
  returning c.id, c.deleted_at into v_customer_id, v_deleted_at;

  if v_customer_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
  values (
    p_business_id,
    'customer.deleted',
    jsonb_build_object(
      'customer_id',   v_customer_id,
      'business_id',   p_business_id,
      'deleted_at',    v_deleted_at,
      'actor_user_id', p_actor_user_id
    ),
    p_actor_user_id
  )
  returning id into v_event_id;

  return query
    select v_customer_id   as customer_id,
           v_event_id      as event_id,
           v_deleted_at    as deleted_at;
end;
$$;

grant execute on function public.marketing_soft_delete_customer(
  uuid, uuid, uuid
) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_merge_customers
--
-- Atomic merge of `loser` into `winner`:
--
--   1. Both rows MUST belong to `p_business_id` (else 'cross_business').
--   2. Loser MUST be live (not already merged, not soft-deleted) (else
--      'already_merged' / 'loser_deleted').
--   3. Winner MUST be live (else 'winner_deleted').
--   4. Copy non-null fields from loser into winner where winner is empty:
--      - name  → keep winner's (winner is the source of truth for identity)
--      - email, address → fill in if winner's are null
--      - notes → append loser.notes on a new line if loser.notes is non-null
--      - manual_tags → union (dedup) of both arrays
--      - phone_e164 → keep winner's (winner is canonical for the phone)
--   5. Re-point every FK registered in `customer_external_refs` from
--      loser → winner, scoped by `business_id = p_business_id` on each
--      target table. Each target table MUST own a `business_id` column.
--   6. Tombstone the loser: merged_into_id = winner_id,
--      deleted_at = now().
--   7. Emit one `customer.merged` outbox event
--      (matched_on = 'manual_prompt' for v1 manual merges).
--
-- Runs as SECURITY DEFINER so it can UPDATE downstream tables the
-- calling user's RLS does not directly cover; every UPDATE is still
-- scoped to `p_business_id`.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_merge_customers(
  p_business_id        uuid,
  p_winner_id          uuid,
  p_loser_id           uuid,
  p_actor_user_id      uuid
)
returns table (
  winner_id   uuid,
  loser_id    uuid,
  event_id    uuid,
  repointed   jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner       record;
  v_loser        record;
  v_now          timestamptz := now();
  v_event_id     uuid;
  v_ref          record;
  v_repointed    jsonb := '[]'::jsonb;
  v_rowcount     bigint;
  v_merged_notes text;
begin
  if p_winner_id = p_loser_id then
    raise exception 'same_customer' using errcode = 'P0001';
  end if;

  select id, business_id, name, phone_e164, email, address,
         manual_tags, notes, deleted_at, merged_into_id
    into v_winner
    from public.customers
   where id = p_winner_id
   for update;
  if not found then
    raise exception 'winner_not_found' using errcode = 'P0001';
  end if;
  if v_winner.business_id <> p_business_id then
    raise exception 'cross_business' using errcode = 'P0001';
  end if;
  if v_winner.deleted_at is not null then
    raise exception 'winner_deleted' using errcode = 'P0001';
  end if;
  if v_winner.merged_into_id is not null then
    raise exception 'winner_already_merged' using errcode = 'P0001';
  end if;

  select id, business_id, name, phone_e164, email, address,
         manual_tags, notes, deleted_at, merged_into_id
    into v_loser
    from public.customers
   where id = p_loser_id
   for update;
  if not found then
    raise exception 'loser_not_found' using errcode = 'P0001';
  end if;
  if v_loser.business_id <> p_business_id then
    raise exception 'cross_business' using errcode = 'P0001';
  end if;
  if v_loser.merged_into_id is not null then
    raise exception 'already_merged' using errcode = 'P0001';
  end if;
  if v_loser.deleted_at is not null then
    raise exception 'loser_deleted' using errcode = 'P0001';
  end if;

  v_merged_notes := case
    when v_loser.notes is null or length(trim(v_loser.notes)) = 0 then v_winner.notes
    when v_winner.notes is null or length(trim(v_winner.notes)) = 0 then v_loser.notes
    else v_winner.notes || E'\n\n-- merged from #' || left(p_loser_id::text, 8) || E' --\n' || v_loser.notes
  end;

  update public.customers
     set email       = coalesce(nullif(email, ''),   v_loser.email),
         address     = coalesce(nullif(address, ''), v_loser.address),
         notes       = v_merged_notes,
         manual_tags = (
           select coalesce(array_agg(distinct t order by t), '{}'::text[])
             from unnest(coalesce(manual_tags, '{}'::text[]) || coalesce(v_loser.manual_tags, '{}'::text[])) as t
            where t is not null and length(t) > 0
         )
   where id = p_winner_id
     and business_id = p_business_id;

  for v_ref in
    select table_name, fk_column
      from public.customer_external_refs
  loop
    execute format(
      'update public.%I set %I = $1 where %I = $2 and business_id = $3',
      v_ref.table_name, v_ref.fk_column, v_ref.fk_column
    )
    using p_winner_id, p_loser_id, p_business_id;
    get diagnostics v_rowcount = ROW_COUNT;
    v_repointed := v_repointed || jsonb_build_object(
      'table_name', v_ref.table_name,
      'fk_column',  v_ref.fk_column,
      'rows',       v_rowcount
    );
  end loop;

  update public.customers
     set merged_into_id = p_winner_id,
         deleted_at     = v_now
   where id = p_loser_id
     and business_id = p_business_id;

  insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
  values (
    p_business_id,
    'customer.merged',
    jsonb_build_object(
      'surviving_customer_id', p_winner_id,
      'discarded_customer_id', p_loser_id,
      'matched_on',            'manual_prompt',
      'actor_user_id',         p_actor_user_id,
      'merged_at',             v_now
    ),
    p_actor_user_id
  )
  returning id into v_event_id;

  return query select p_winner_id, p_loser_id, v_event_id, v_repointed;
end;
$$;

grant execute on function public.marketing_merge_customers(
  uuid, uuid, uuid, uuid
) to authenticated;
