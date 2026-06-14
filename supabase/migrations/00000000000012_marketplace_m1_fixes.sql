-- Bantu Niaga — Marketplace m1 fixes
-- =====================================================================
-- The first cut of marketplace_activate_addon assumed an `amount_cents`
-- + `meta` column on `public.invoices`; the actual schema uses
-- `amount_myr` (numeric) and `period_label`. Re-define the RPC with
-- the right column names so activation flows can write invoices.
-- =====================================================================

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
    case
      when v_addon.cadence = 'monthly' then now() + interval '30 days'
      when v_addon.cadence = 'yearly'  then now() + interval '365 days'
      else null
    end
  )
  returning * into v_row;

  if v_addon.cadence in ('monthly','yearly','one_time')
     and v_addon.price_cents > 0
     and not (v_addon.included_in_tier @> array[v_business.tier]) then

    if v_addon.cadence = 'monthly' then
      v_days_left := greatest(0, 30 -
        extract(day from age(now(), coalesce(v_business.subscription_renewal_at - interval '30 days', now())))::int
      );
      v_proration_cents := (v_addon.price_cents::numeric * v_days_left / 30)::int * greatest(1, p_qty);
    elsif v_addon.cadence = 'yearly' then
      v_proration_cents := v_addon.price_cents * greatest(1, p_qty);
    else
      v_proration_cents := v_addon.price_cents * greatest(1, p_qty);
    end if;

    v_amount_myr := round(v_proration_cents::numeric / 100, 2);

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

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.activate', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug, 'qty', greatest(1, p_qty))
  );

  return v_row;
end;
$$;
