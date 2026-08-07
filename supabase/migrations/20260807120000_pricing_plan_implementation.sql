-- Pricing plan v2026-08: basic tier, new prices, promos, usage metering, scaled add-ons.

-- ---------------------------------------------------------------------------
-- Tier constraint + pricing helpers
-- ---------------------------------------------------------------------------

alter table public.businesses
  drop constraint if exists businesses_tier_check;

alter table public.businesses
  add constraint businesses_tier_check
  check (tier in ('starter', 'basic', 'micro', 'sme', 'enterprise'));

create or replace function public.subscription_tier_amount_myr(p_tier text)
returns numeric
language sql
immutable
as $$
  select case p_tier
    when 'starter' then 0::numeric
    when 'basic' then 39::numeric
    when 'micro' then 79::numeric
    when 'sme' then 169::numeric
    when 'enterprise' then 299::numeric
    else 0::numeric
  end;
$$;

create or replace function public.subscription_tier_bundled_credits(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'starter' then 0
    when 'basic' then 60
    when 'micro' then 120
    when 'sme' then 180
    when 'enterprise' then 360
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Subscription promotions (campaign / super-admin provision)
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_promotions (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  promo_tier text not null
    check (promo_tier in ('starter', 'basic', 'micro', 'sme', 'enterprise')),
  post_promo_tier text not null
    check (post_promo_tier in ('starter', 'basic', 'micro', 'sme', 'enterprise')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  campaign_code text,
  granted_by uuid references public.platform_admins(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_promotions_business_active_idx
  on public.subscription_promotions (business_id, ends_at desc);

alter table public.subscription_promotions enable row level security;

create policy subscription_promotions_service on public.subscription_promotions
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Monthly usage rollup (email COGS scaffold)
-- ---------------------------------------------------------------------------

create table if not exists public.business_usage_monthly (
  business_id uuid not null references public.businesses(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  emails_sent integer not null default 0,
  email_cogs_myr numeric(10, 4) not null default 0,
  ai_cogs_myr numeric(10, 4) not null default 0,
  plan_mrr_myr numeric(10, 2) not null default 0,
  guardrail_status text not null default 'ok'
    check (guardrail_status in ('ok', 'warn', 'throttle', 'abuse')),
  updated_at timestamptz not null default now(),
  primary key (business_id, month)
);

alter table public.business_usage_monthly enable row level security;

create policy business_usage_monthly_select on public.business_usage_monthly
  for select using (business_id = public.current_business_id());

create policy business_usage_monthly_write on public.business_usage_monthly
  for all using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy business_usage_monthly_service on public.business_usage_monthly
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Active promo helper
-- ---------------------------------------------------------------------------

create or replace function public.subscription_active_promo_tier(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sp.promo_tier
    from public.subscription_promotions sp
   where sp.business_id = p_business_id
     and sp.ends_at > now()
   order by sp.ends_at desc
   limit 1;
$$;

create or replace function public.subscription_effective_tier(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.subscription_active_promo_tier(p_business_id),
    (select tier from public.businesses where id = p_business_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Issue invoice — respect active promo (RM0 during promo window)
-- ---------------------------------------------------------------------------

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
  v_promo_tier text;
begin
  select tier, subscription_status
    into v_tier, v_status
    from public.businesses
   where id = p_business_id;

  if v_tier is null then
    raise exception 'business not found';
  end if;

  v_amount := coalesce(p_amount_myr, public.subscription_tier_amount_myr(v_tier));

  if v_tier = 'starter' or v_status = 'trial' then
    v_amount := 0;
  end if;

  select public.subscription_active_promo_tier(p_business_id) into v_promo_tier;
  if v_promo_tier is not null then
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
        'subscription_status', v_status,
        'promo_tier', v_promo_tier
      )
    );
  end if;

  return v_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tier change + bundled credit grant
-- ---------------------------------------------------------------------------

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
  v_credits integer;
begin
  if p_tier not in ('starter', 'basic', 'micro', 'sme', 'enterprise') then
    raise exception 'invalid tier %', p_tier;
  end if;

  select tier, subscription_status
    into v_old, v_status
    from public.businesses
   where id = p_business_id;

  update public.businesses
     set tier = p_tier,
         subscription_status = 'active',
         subscription_renewal_at = now() + interval '30 days'
   where id = p_business_id;

  perform public.settings_issue_subscription_invoice(
    p_business_id,
    p_user_id,
    to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') || ' — plan change',
    public.subscription_tier_amount_myr(p_tier)
  );

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
    jsonb_build_object('from', v_old, 'to', p_tier, 'credits_granted', v_credits)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Renewal cron — grant bundled credits on paid renewal
-- ---------------------------------------------------------------------------

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
  v_credits integer;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at
      from public.businesses
     where subscription_renewal_at is not null
       and subscription_renewal_at <= now()
       and subscription_status in ('active', 'trial')
  loop
    if v_row.subscription_status = 'trial' then
      v_label := '14-day trial ended';
      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        0
      );
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

      v_credits := public.subscription_tier_bundled_credits(v_row.tier);
      if v_credits > 0 then
        perform public.settings_grant_credits(
          v_row.id,
          v_credits,
          'subscription_monthly_grant',
          null
        );
      end if;

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

-- ---------------------------------------------------------------------------
-- Promo expiry — downgrade to post_promo_tier
-- ---------------------------------------------------------------------------

create or replace function public.subscription_process_promo_expiry()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_credits integer;
begin
  for v_row in
    select sp.id, sp.business_id, sp.post_promo_tier
      from public.subscription_promotions sp
     where sp.ends_at <= now()
       and not exists (
         select 1
           from public.subscription_promotions sp2
          where sp2.business_id = sp.business_id
            and sp2.ends_at > now()
       )
  loop
    update public.businesses
       set tier = v_row.post_promo_tier,
           subscription_status = 'active',
           subscription_renewal_at = now() + interval '30 days'
     where id = v_row.business_id;

    v_credits := public.subscription_tier_bundled_credits(v_row.post_promo_tier);
    if v_credits > 0 then
      perform public.settings_grant_credits(
        v_row.business_id,
        v_credits,
        'subscription_monthly_grant',
        null
      );
    end if;

    insert into public.audit_log (
      business_id, actor_user_id, action, entity_type, entity_id, diff
    )
    values (
      v_row.business_id,
      null,
      'subscription.promo_expired',
      'business',
      v_row.business_id,
      jsonb_build_object('post_promo_tier', v_row.post_promo_tier)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.subscription_process_promo_expiry() to service_role;

-- ---------------------------------------------------------------------------
-- Mark AI assistant addons as plan-included (UI catalog metadata)
-- ---------------------------------------------------------------------------

update public.marketplace_addons
   set included_in_tier = array['basic', 'micro', 'sme', 'enterprise']::text[]
 where slug in (
   'admin-assistant',
   'sales-assistant',
   'finance-assistant'
 );

update public.marketplace_addons
   set included_in_tier = array['micro', 'sme', 'enterprise']::text[]
 where slug in (
   'operations-assistant',
   'hr-assistant',
   'marketing-assistant'
 );

-- Scaled add-on prices (pricing-plan §9, cents)
update public.marketplace_addons
   set price_cents = case slug
     when 'storage-10gb' then 500
     when 'boost-credits-100' then 1000
     when 'boost-credits-300' then 2800
     when 'boost-credits-500' then 4500
     when 'finance-recurring-invoices' then 900
     when 'ops-booking-page' then 900
     when 'ops-advanced-inventory' then 900
     when 'marketing-automation' then 1100
     when 'hr-staff-portal' then 900
     when 'hr-shift-attendance' then 1600
     when 'finance-bank-recon' then 1400
     when 'admin-digital-signature' then 800
     when 'whatsapp-business-api' then 1600
     when 'hr-payroll-statutory' then 1600
     when 'sales-shopee-sync' then 1400
     when 'sales-tiktok-sync' then 1400
     else price_cents
   end
 where slug in (
   'storage-10gb',
   'boost-credits-100',
   'boost-credits-300',
   'boost-credits-500',
   'finance-recurring-invoices',
   'ops-booking-page',
   'ops-advanced-inventory',
   'marketing-automation',
   'hr-staff-portal',
   'hr-shift-attendance',
   'finance-bank-recon',
   'admin-digital-signature',
   'whatsapp-business-api',
   'hr-payroll-statutory',
   'sales-shopee-sync',
   'sales-tiktok-sync'
 );

-- HR public holidays core on Solo+ (no addon purchase required)
update public.marketplace_addons
   set included_in_tier = array['micro', 'sme', 'enterprise']::text[],
       cadence = 'included'
 where slug = 'hr-public-holidays';
