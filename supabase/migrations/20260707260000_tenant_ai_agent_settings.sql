-- Extend per-tenant AI agent settings + seed module assistant add-ons.

alter table public.business_agent_settings
  add column if not exists reasoning_mode text not null default 'fast'
    check (reasoning_mode in ('fast', 'deep', 'auto')),
  add column if not exists daily_budget_myr numeric(10, 2) not null default 5.00
    check (daily_budget_myr >= 1 and daily_budget_myr <= 20);

-- Module AI assistant add-ons (marketplace).
insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order, is_featured
)
values
  (
    'marketing-assistant',
    'Marketing AI (Maya)',
    'Captions, segments, and posting tips for your CRM.',
    'Maya drafts social captions, tags customers, and flags churn risk. 100 AI credits/month included.',
    'marketing',
    'sparkles',
    2000,
    'monthly',
    11,
    true
  ),
  (
    'finance-assistant',
    'Finance AI (Fayza)',
    'Invoice help, expense checks, and cash-flow snapshots.',
    'Fayza reconciles invoices, spots duplicate expenses, and forecasts cash flow. 100 AI credits/month included.',
    'finance',
    'trending-up',
    2000,
    'monthly',
    12,
    false
  ),
  (
    'operations-assistant',
    'Operations AI (Aiman)',
    'Stock alerts, supplier tips, and booking insights.',
    'Aiman tracks low stock, compares supplier prices, and optimises bookings. 100 AI credits/month included.',
    'operations',
    'shopping-bag',
    2000,
    'monthly',
    13,
    false
  ),
  (
    'sales-assistant',
    'Sales AI (Sufi)',
    'POS insights, lead follow-ups, and pipeline nudges.',
    'Sufi helps your floor team close deals and follow up leads. 100 AI credits/month included.',
    'sales',
    'megaphone',
    2000,
    'monthly',
    14,
    false
  )
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  price_cents = excluded.price_cents,
  is_featured = excluded.is_featured;

-- Grant credits + seed settings when any module assistant add-on is activated.
create or replace function public.marketplace_activate_addon(
  p_addon_slug text,
  p_qty integer default 1
) returns public.business_addons
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id     uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_role        text := public.current_role();
  v_addon       public.marketplace_addons%rowtype;
  v_existing    public.business_addons%rowtype;
  v_row         public.business_addons%rowtype;
  v_business    public.businesses%rowtype;
  v_proration_cents integer;
  v_amount_myr  numeric(10,2);
  v_days_left   integer;
  v_invoice_number text;
  v_agent_slug  text;
  v_display_name text;
begin
  if v_business_id is null or v_user_id is null then
    raise exception 'unauthorized';
  end if;
  if v_role <> 'owner' then
    raise exception 'owner role required';
  end if;

  select * into v_addon from public.marketplace_addons
   where slug = p_addon_slug;
  if not found then
    raise exception 'addon not found: %', p_addon_slug;
  end if;

  select * into v_business from public.businesses where id = v_business_id;

  select * into v_existing from public.business_addons
    where business_id = v_business_id and addon_id = v_addon.id
      and status <> 'cancelled'
    limit 1;
  if found then
    return v_existing;
  end if;

  insert into public.business_addons (business_id, addon_id, qty, status, activated_at, next_charge_at)
  values (
    v_business_id,
    v_addon.id,
    greatest(1, p_qty),
    'active',
    now(),
    case when v_addon.cadence = 'monthly' then now() + interval '30 days' else null end
  )
  returning * into v_row;

  if v_addon.price_cents > 0 and v_addon.cadence = 'monthly' then
    v_days_left := greatest(
      1,
      extract(day from (v_business.subscription_renewal_at - now()))::integer
    );
    v_proration_cents := round(
      (v_addon.price_cents::numeric / 30) * v_days_left
    );
    v_amount_myr := v_proration_cents / 100.0;

    v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        substr(extensions.uuid_generate_v4()::text, 1, 6);

    insert into public.invoices (business_id, number, kind, period_label, amount_myr, tax_myr, status, paid_at)
    values (
      v_business_id,
      v_invoice_number,
      'addon',
      v_addon.name,
      v_amount_myr,
      0,
      'paid',
      now()
    );
  end if;

  v_agent_slug := case p_addon_slug
    when 'hr-assistant' then 'hr'
    when 'marketing-assistant' then 'marketing'
    when 'finance-assistant' then 'finance'
    when 'operations-assistant' then 'operations'
    when 'sales-assistant' then 'sales'
    else null
  end;

  v_display_name := case p_addon_slug
    when 'hr-assistant' then 'Hana'
    when 'marketing-assistant' then 'Maya'
    when 'finance-assistant' then 'Fayza'
    when 'operations-assistant' then 'Aiman'
    when 'sales-assistant' then 'Sufi'
    else null
  end;

  if v_agent_slug is not null then
    perform public.settings_grant_credits(
      v_business_id, 100, p_addon_slug || '_monthly_grant', v_user_id
    );

    insert into public.business_agent_settings (
      business_id, agent_slug, display_name, assistant_enabled, daily_notice_enabled
    )
    values (
      v_business_id,
      v_agent_slug,
      coalesce(v_display_name, 'Assistant'),
      true,
      case when v_agent_slug = 'hr' then true else false end
    )
    on conflict (business_id, agent_slug) do update set
      assistant_enabled = true,
      updated_at = now();
  end if;

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.activate', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug, 'qty', greatest(1, p_qty))
  );

  return v_row;
end;
$$;
