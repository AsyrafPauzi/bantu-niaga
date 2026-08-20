-- Paid subscription checkout via Billplz (pending invoice → webhook → apply tier).
-- Reuses public.billplz_payment_intents (kind = 'subscription', meta.pending_tier).

alter table public.businesses
  add column if not exists first_paid_at timestamptz;

-- Top-up complete must ignore subscription intents.
create or replace function public.settings_complete_topup_billplz(
  p_billplz_id text
)
returns table (business_id uuid, new_balance integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_intent public.billplz_payment_intents%rowtype;
  v_balance integer;
  v_user_id uuid;
begin
  select * into v_intent
    from public.billplz_payment_intents
   where billplz_id = p_billplz_id
   for update;

  if not found then
    raise exception 'intent not found';
  end if;

  if v_intent.kind is distinct from 'topup' then
    raise exception 'intent not found';
  end if;

  if v_intent.status = 'paid' then
    select credit_balance into v_balance
      from public.businesses where id = v_intent.business_id;
    return query select v_intent.business_id, v_balance;
    return;
  end if;

  v_user_id := (v_intent.meta->>'user_id')::uuid;

  update public.invoices
     set status = 'paid', paid_at = now()
   where id = v_intent.invoice_id;

  insert into public.credit_ledger (
    business_id, delta, reason, invoice_id, actor_user_id
  )
  values (
    v_intent.business_id, v_intent.credits, 'topup',
    v_intent.invoice_id, v_user_id
  );

  update public.businesses
     set credit_balance = credit_balance + v_intent.credits,
         credit_topup_balance = coalesce(credit_topup_balance, 0) + v_intent.credits
   where id = v_intent.business_id
   returning credit_balance into v_balance;

  update public.billplz_payment_intents
     set status = 'paid', paid_at = now()
   where id = v_intent.id;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    v_intent.business_id, v_user_id, 'billing.topup', 'invoice', v_intent.invoice_id,
    jsonb_build_object(
      'credits', v_intent.credits,
      'amount_myr', v_intent.amount_myr,
      'billplz_id', p_billplz_id
    )
  );

  return query select v_intent.business_id, v_balance;
end;
$$;

-- Apply paid tier after payment (no second invoice — invoice already pending/paid).
create or replace function public.settings_apply_paid_tier(
  p_business_id uuid,
  p_tier text,
  p_user_id uuid default null,
  p_set_first_paid boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old text;
  v_credits integer;
begin
  if p_tier not in ('basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid paid tier %', p_tier;
  end if;

  select tier into v_old
    from public.businesses
   where id = p_business_id
   for update;

  if v_old is null then
    raise exception 'business not found';
  end if;

  update public.businesses
     set tier = p_tier,
         subscription_status = 'active',
         subscription_renewal_at = now() + interval '30 days',
         first_paid_at = case
           when p_set_first_paid and first_paid_at is null then now()
           else first_paid_at
         end
   where id = p_business_id;

  v_credits := public.subscription_tier_bundled_credits(p_tier);
  if v_credits > 0 then
    perform public.settings_grant_credits(
      p_business_id,
      v_credits,
      'subscription_monthly_grant',
      p_user_id
    );
  end if;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id,
    p_user_id,
    'subscription.tier_change',
    'business',
    p_business_id,
    jsonb_build_object(
      'from', v_old,
      'to', p_tier,
      'credits_granted', v_credits,
      'via', 'billplz'
    )
  );
end;
$$;

create or replace function public.settings_create_subscription_pending(
  p_business_id uuid,
  p_tier text,
  p_amount_myr numeric,
  p_user_id uuid,
  p_billplz_id text,
  p_billplz_url text
)
returns table (invoice_id uuid, intent_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice_id uuid;
  v_intent_id uuid;
  v_number text;
  v_label text;
begin
  if p_tier not in ('basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid paid tier %', p_tier;
  end if;

  if p_amount_myr is null or p_amount_myr <= 0 then
    raise exception 'amount must be positive';
  end if;

  v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
    || ' — plan ' || p_tier;

  v_number := 'SUB-' || to_char(now(), 'YYYYMMDD') || '-' ||
              substring(extensions.uuid_generate_v4()::text from 1 for 6);

  insert into public.invoices (
    business_id, number, kind, period_label,
    amount_myr, tax_myr, status, paid_at
  )
  values (
    p_business_id,
    v_number,
    'subscription',
    v_label,
    p_amount_myr,
    0,
    'pending',
    null
  )
  returning id into v_invoice_id;

  insert into public.billplz_payment_intents (
    business_id, invoice_id, billplz_id, billplz_url,
    kind, credits, amount_myr, status, meta
  )
  values (
    p_business_id, v_invoice_id, p_billplz_id, p_billplz_url,
    'subscription', null, p_amount_myr, 'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'pending_tier', p_tier
    )
  )
  returning id into v_intent_id;

  return query select v_invoice_id, v_intent_id;
end;
$$;

grant execute on function public.settings_create_subscription_pending(
  uuid, text, numeric, uuid, text, text
) to authenticated;

create or replace function public.settings_complete_subscription_billplz(
  p_billplz_id text
)
returns table (business_id uuid, tier text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_intent public.billplz_payment_intents%rowtype;
  v_tier text;
  v_user_id uuid;
begin
  select * into v_intent
    from public.billplz_payment_intents
   where billplz_id = p_billplz_id
   for update;

  if not found then
    raise exception 'intent not found';
  end if;

  if v_intent.kind is distinct from 'subscription' then
    raise exception 'intent not found';
  end if;

  v_tier := v_intent.meta->>'pending_tier';
  if v_tier is null or v_tier not in ('basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid pending_tier';
  end if;

  v_user_id := (v_intent.meta->>'user_id')::uuid;

  if v_intent.status = 'paid' then
    return query
      select v_intent.business_id, b.tier::text
        from public.businesses b
       where b.id = v_intent.business_id;
    return;
  end if;

  update public.invoices
     set status = 'paid', paid_at = now()
   where id = v_intent.invoice_id;

  perform public.settings_apply_paid_tier(
    v_intent.business_id,
    v_tier,
    v_user_id,
    true
  );

  update public.billplz_payment_intents
     set status = 'paid', paid_at = now()
   where id = v_intent.id;

  return query select v_intent.business_id, v_tier;
end;
$$;

revoke all on function public.settings_complete_subscription_billplz(text) from public;
grant execute on function public.settings_complete_subscription_billplz(text) to service_role;

revoke all on function public.settings_apply_paid_tier(uuid, text, uuid, boolean) from public;
grant execute on function public.settings_apply_paid_tier(uuid, text, uuid, boolean) to service_role;
