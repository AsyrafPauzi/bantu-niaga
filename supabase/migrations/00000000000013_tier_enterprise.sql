-- ============================================================================
-- 00000000000013_tier_enterprise.sql
--
-- Tier model widening: include the `enterprise` tier as a real, switchable
-- plan (was previously "talk to sales" / unrepresentable in the DB check
-- constraint).
--
-- This enables the entitlement matrix introduced in
-- `lib/auth/entitlements.ts` to be exercised end-to-end:
--   - starter     → Finance only.
--   - micro       → Finance + Admin + Operations.
--   - sme         → Finance + Admin + Operations + Sales + HR.
--   - enterprise  → all six pillars including Marketing.
--
-- Changes:
--   1. Relax the `businesses.tier` check to allow `enterprise`.
--   2. Update `settings_change_tier` RPC's input guard.
-- ============================================================================

alter table public.businesses
  drop constraint if exists businesses_tier_check;

alter table public.businesses
  add constraint businesses_tier_check
  check (tier in ('starter', 'micro', 'sme', 'enterprise'));

create or replace function public.settings_change_tier(
  p_business_id uuid,
  p_tier text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old text;
begin
  if p_tier not in ('starter', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid tier %', p_tier;
  end if;

  select tier into v_old from public.businesses where id = p_business_id;

  update public.businesses
     set tier = p_tier,
         subscription_renewal_at = greatest(
           subscription_renewal_at,
           now() + interval '30 days'
         )
   where id = p_business_id;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id, p_user_id, 'subscription.tier_change', 'business',
    p_business_id,
    jsonb_build_object('from', v_old, 'to', p_tier)
  );
end;
$$;

grant execute on function public.settings_change_tier(uuid, text, uuid) to authenticated;
