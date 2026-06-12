-- ============================================================================
-- Bantu Niaga — Marketing M2 fixes (post-verification)
-- ============================================================================
-- Live verification of M2 revealed a bug in `marketing_soft_delete_customer`:
--
-- The function ran `security invoker` so RLS applied as the caller. Its
-- `UPDATE … RETURNING` statement sets `deleted_at = now()`, but the
-- existing `customers_select_self_business` policy filters out rows where
-- `deleted_at is not null`. After the UPDATE, the RETURNING row could no
-- longer pass the SELECT-on-RETURNING visibility check and Postgres
-- rejected the statement with "new row violates row-level security
-- policy for table customers". Result: DELETE /api/marketing/customers
-- /[id] returned 500.
--
-- Fix: recreate the function as `security definer` (mirroring
-- `marketing_merge_customers`, which already bypasses RLS for the same
-- structural reason). The function still scopes every write with
-- `business_id = p_business_id`, so cross-tenant safety holds.
-- ============================================================================

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
security definer
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
