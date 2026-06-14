-- ============================================================================
-- Bantu Niaga — Company Settings M1 fixes
-- ============================================================================
-- The settings_topup_credits RPC was created with `set search_path = public`,
-- but `uuid_generate_v4()` lives in the `extensions` schema on Supabase. The
-- fix is to extend the search_path to include `extensions`. Same change for
-- settings_change_tier in case it ever calls extension functions.
-- ============================================================================

create or replace function public.settings_topup_credits(
  p_business_id uuid,
  p_credits integer,
  p_amount_myr numeric,
  p_payment_method_id uuid,
  p_user_id uuid
)
returns table (
  invoice_id uuid,
  new_balance integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice_id uuid;
  v_number text;
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  v_number := 'TU-' || to_char(now(), 'YYYYMMDD') || '-' ||
              substring(extensions.uuid_generate_v4()::text from 1 for 6);

  insert into public.invoices (
    business_id, number, kind, period_label,
    amount_myr, tax_myr, status, payment_method_id, paid_at
  )
  values (
    p_business_id, v_number, 'topup', 'Fast Credits top-up',
    p_amount_myr, 0, 'paid', p_payment_method_id, now()
  )
  returning id into v_invoice_id;

  insert into public.credit_ledger (
    business_id, delta, reason, invoice_id, actor_user_id
  )
  values (p_business_id, p_credits, 'topup', v_invoice_id, p_user_id);

  update public.businesses
     set credit_balance = credit_balance + p_credits
   where id = p_business_id
   returning credit_balance into v_balance;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id, p_user_id, 'billing.topup', 'invoice', v_invoice_id,
    jsonb_build_object('credits', p_credits, 'amount_myr', p_amount_myr)
  );

  return query select v_invoice_id, v_balance;
end;
$$;

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
  if p_tier not in ('starter', 'micro', 'sme') then
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

grant execute on function public.settings_topup_credits(uuid, integer, numeric, uuid, uuid) to authenticated;
grant execute on function public.settings_change_tier(uuid, text, uuid) to authenticated;
