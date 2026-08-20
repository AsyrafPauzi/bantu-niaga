-- Annual billing: pay-10-get-12 (2 months free, ~16.7% discount).
-- Adds billing_cadence to businesses and updates subscription RPCs.

-- ─────────────────────────────────────────────────────────────────
-- 1. Column: billing_cadence on businesses
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS billing_cadence text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cadence IN ('monthly', 'annual'));

COMMENT ON COLUMN public.businesses.billing_cadence IS
  'monthly = renewed every 30d; annual = renewed every 365d (pay-10-get-12)';

-- ─────────────────────────────────────────────────────────────────
-- 2. Helper: annual price = monthly * 10
-- ─────────────────────────────────────────────────────────────────

create or replace function public.subscription_tier_annual_amount_myr(p_tier text)
returns numeric
language sql
immutable
as $$
  select public.subscription_tier_amount_myr(p_tier) * 10;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. settings_apply_paid_tier — support billing_cadence
-- ─────────────────────────────────────────────────────────────────

create or replace function public.settings_apply_paid_tier(
  p_business_id    uuid,
  p_tier           text,
  p_user_id        uuid    default null,
  p_set_first_paid boolean default true,
  p_billing_cadence text   default 'monthly'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old     text;
  v_credits integer;
  v_renewal interval;
begin
  if p_tier not in ('basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid paid tier %', p_tier;
  end if;

  if p_billing_cadence not in ('monthly', 'annual') then
    raise exception 'invalid billing_cadence %', p_billing_cadence;
  end if;

  select tier into v_old
    from public.businesses
   where id = p_business_id
   for update;

  if v_old is null then
    raise exception 'business not found';
  end if;

  v_renewal := case p_billing_cadence
    when 'annual' then interval '365 days'
    else interval '30 days'
  end;

  update public.businesses
     set tier                  = p_tier,
         subscription_status   = 'active',
         subscription_renewal_at = now() + v_renewal,
         billing_cadence       = p_billing_cadence,
         first_paid_at         = case
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
      'from',             v_old,
      'to',               p_tier,
      'billing_cadence',  p_billing_cadence,
      'credits_granted',  v_credits,
      'via',              'billplz'
    )
  );
end;
$$;

revoke all on function public.settings_apply_paid_tier(uuid, text, uuid, boolean, text) from public;
grant execute on function public.settings_apply_paid_tier(uuid, text, uuid, boolean, text) to service_role;

-- ─────────────────────────────────────────────────────────────────
-- 4. settings_create_subscription_pending — store billing_cadence in meta
-- ─────────────────────────────────────────────────────────────────

create or replace function public.settings_create_subscription_pending(
  p_business_id     uuid,
  p_tier            text,
  p_amount_myr      numeric,
  p_user_id         uuid,
  p_billplz_id      text,
  p_billplz_url     text,
  p_billing_cadence text default 'monthly'
)
returns table (invoice_id uuid, intent_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice_id uuid;
  v_intent_id  uuid;
  v_number     text;
  v_label      text;
begin
  if p_tier not in ('basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid paid tier %', p_tier;
  end if;

  if p_billing_cadence not in ('monthly', 'annual') then
    raise exception 'invalid billing_cadence %', p_billing_cadence;
  end if;

  if p_amount_myr is null or p_amount_myr <= 0 then
    raise exception 'amount must be positive';
  end if;

  v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
    || ' — plan ' || p_tier
    || case p_billing_cadence when 'annual' then ' (annual)' else '' end;

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
      'user_id',          p_user_id,
      'pending_tier',     p_tier,
      'billing_cadence',  p_billing_cadence
    )
  )
  returning id into v_intent_id;

  return query select v_invoice_id, v_intent_id;
end;
$$;

grant execute on function public.settings_create_subscription_pending(
  uuid, text, numeric, uuid, text, text, text
) to authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 5. settings_complete_subscription_billplz — propagate billing_cadence
-- ─────────────────────────────────────────────────────────────────

create or replace function public.settings_complete_subscription_billplz(
  p_billplz_id text
)
returns table (business_id uuid, tier text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_intent         public.billplz_payment_intents%rowtype;
  v_tier           text;
  v_user_id        uuid;
  v_billing_cadence text;
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

  v_user_id        := (v_intent.meta->>'user_id')::uuid;
  v_billing_cadence := coalesce(v_intent.meta->>'billing_cadence', 'monthly');

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
    true,
    v_billing_cadence
  );

  update public.billplz_payment_intents
     set status = 'paid', paid_at = now()
   where id = v_intent.id;

  return query select v_intent.business_id, v_tier;
end;
$$;

revoke all on function public.settings_complete_subscription_billplz(text) from public;
grant execute on function public.settings_complete_subscription_billplz(text) to service_role;

-- ─────────────────────────────────────────────────────────────────
-- 6. subscription_process_renewals — handle annual cadence
-- ─────────────────────────────────────────────────────────────────

create or replace function public.subscription_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row    record;
  v_count  integer := 0;
  v_label  text;
  v_next   interval;
  v_amount numeric;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at,
           coalesce(billing_cadence, 'monthly') as billing_cadence
      from public.businesses
     where subscription_renewal_at is not null
       and subscription_renewal_at <= now()
       and subscription_status in ('active', 'trial')
  loop
    if v_row.subscription_status = 'trial' then
      v_label := '14-day Starter trial';
      perform public.settings_issue_subscription_invoice(
        v_row.id, null, v_label, 0
      );
      -- Trial ended — move to Free.
      update public.businesses
         set tier                  = 'starter',
             subscription_status   = 'active',
             billing_cadence       = 'monthly',
             subscription_renewal_at = now() + interval '30 days'
       where id = v_row.id;
    else
      v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
        || case when v_row.tier = 'starter' then ' — Free plan' else '' end
        || case when v_row.billing_cadence = 'annual' then ' (annual)' else '' end;

      v_amount := case
        when v_row.billing_cadence = 'annual'
          then public.subscription_tier_annual_amount_myr(v_row.tier)
        else public.subscription_tier_amount_myr(v_row.tier)
      end;

      perform public.settings_issue_subscription_invoice(
        v_row.id, null, v_label, v_amount
      );

      v_next := case v_row.billing_cadence
        when 'annual' then interval '365 days'
        else interval '30 days'
      end;

      update public.businesses
         set subscription_renewal_at = now() + v_next
       where id = v_row.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.subscription_process_renewals() to service_role;
