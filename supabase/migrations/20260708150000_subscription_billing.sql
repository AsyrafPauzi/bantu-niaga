-- Subscription billing: RM0 invoices for Free/trial, monthly renewal for Free, tier-change invoices.

create or replace function public.subscription_tier_amount_myr(p_tier text)
returns numeric
language sql
immutable
as $$
  select case p_tier
    when 'starter' then 0::numeric
    when 'micro' then 69::numeric
    when 'sme' then 139::numeric
    when 'enterprise' then 249::numeric
    else 0::numeric
  end;
$$;

create or replace function public.settings_issue_subscription_invoice(
  p_business_id uuid,
  p_user_id uuid default null,
  p_period_label text default null,
  p_amount_myr numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tier text;
  v_status text;
  v_amount numeric(10, 2);
  v_label text;
  v_number text;
  v_invoice_id uuid;
begin
  select tier, subscription_status
    into v_tier, v_status
    from public.businesses
   where id = p_business_id;

  if v_tier is null then
    raise exception 'business not found';
  end if;

  v_amount := coalesce(p_amount_myr, public.subscription_tier_amount_myr(v_tier));

  -- Free tier and active trials are always RM0 on the invoice record.
  if v_tier = 'starter' or v_status = 'trial' then
    v_amount := 0;
  end if;

  v_label := coalesce(
    p_period_label,
    to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
  );

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
    v_amount,
    0,
    'paid',
    now()
  )
  returning id into v_invoice_id;

  if p_user_id is not null then
    insert into public.audit_log (
      business_id, actor_user_id, action, entity_type, entity_id, diff
    )
    values (
      p_business_id,
      p_user_id,
      'billing.subscription_invoice',
      'invoice',
      v_invoice_id,
      jsonb_build_object(
        'period_label', v_label,
        'amount_myr', v_amount,
        'tier', v_tier,
        'subscription_status', v_status
      )
    );
  end if;

  return v_invoice_id;
end;
$$;

grant execute on function public.settings_issue_subscription_invoice(uuid, uuid, text, numeric)
  to authenticated, service_role;

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
  v_status text;
  v_renewal interval;
begin
  if p_tier not in ('starter', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid tier %', p_tier;
  end if;

  select tier, subscription_status
    into v_old, v_status
    from public.businesses
   where id = p_business_id;

  v_renewal := interval '30 days';

  update public.businesses
     set tier = p_tier,
         subscription_status = 'active',
         subscription_renewal_at = now() + v_renewal
   where id = p_business_id;

  perform public.settings_issue_subscription_invoice(
    p_business_id,
    p_user_id,
    to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') || ' — plan change',
    public.subscription_tier_amount_myr(p_tier)
  );

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id,
    p_user_id,
    'subscription.tier_change',
    'business',
    p_business_id,
    jsonb_build_object('from', v_old, 'to', p_tier)
  );
end;
$$;

grant execute on function public.settings_change_tier(uuid, text, uuid) to authenticated;

-- Daily cron: issue subscription invoice when renewal date passes.
create or replace function public.subscription_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_label text;
  v_next interval;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at
      from public.businesses
     where subscription_renewal_at is not null
       and subscription_renewal_at <= now()
       and subscription_status in ('active', 'trial')
  loop
    if v_row.subscription_status = 'trial' then
      v_label := '14-day Starter trial';
      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        0
      );
      -- Trial ended — move to Free unless owner upgrades with payment later.
      update public.businesses
         set tier = 'starter',
             subscription_status = 'active',
             subscription_renewal_at = now() + interval '30 days'
       where id = v_row.id;
    else
      v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') ||
        case when v_row.tier = 'starter' then ' — Free plan' else '' end;

      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        public.subscription_tier_amount_myr(v_row.tier)
      );

      v_next := interval '30 days';
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

-- Data fixes: Free tier should not sit on trial with a 14-day renewal.
update public.businesses
   set subscription_status = 'active',
       subscription_renewal_at = coalesce(
         subscription_renewal_at,
         created_at + interval '30 days',
         now() + interval '30 days'
       )
 where tier = 'starter'
   and subscription_status = 'trial';

update public.businesses
   set subscription_renewal_at = coalesce(
         subscription_renewal_at,
         created_at + interval '30 days',
         now() + interval '30 days'
       )
 where tier = 'starter'
   and subscription_status = 'active'
   and subscription_renewal_at is null;
