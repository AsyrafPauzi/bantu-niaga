-- Disable = turn off in-app feature; billing continues.
-- Cancel (marketplace_deactivate_addon) = stop billing at next_charge_at.

create or replace function public.marketplace_disable_addon_feature(
  p_addon_slug text
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
  v_row         public.business_addons%rowtype;
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

  update public.business_addons
     set meta       = coalesce(meta, '{}'::jsonb) || jsonb_build_object('feature_disabled', true),
         updated_at = now()
   where business_id = v_business_id
     and addon_id    = v_addon.id
     and status in ('active', 'pending_cancel')
   returning * into v_row;

  if not found then
    raise exception 'addon is not active';
  end if;

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.disable_feature', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug)
  );

  return v_row;
end;
$$;

create or replace function public.marketplace_enable_addon_feature(
  p_addon_slug text
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
  v_row         public.business_addons%rowtype;
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

  update public.business_addons
     set meta       = coalesce(meta, '{}'::jsonb) || jsonb_build_object('feature_disabled', false),
         updated_at = now()
   where business_id = v_business_id
     and addon_id    = v_addon.id
     and status in ('active', 'pending_cancel')
   returning * into v_row;

  if not found then
    raise exception 'addon is not active';
  end if;

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.enable_feature', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug)
  );

  return v_row;
end;
$$;

create or replace function public.marketplace_reactivate_addon(
  p_addon_slug text
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
  v_row         public.business_addons%rowtype;
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

  update public.business_addons
     set status     = 'active',
         cancel_at  = null,
         updated_at = now()
   where business_id = v_business_id
     and addon_id    = v_addon.id
     and status      = 'pending_cancel'
   returning * into v_row;

  if not found then
    raise exception 'addon is not pending cancel';
  end if;

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.reactivate', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug)
  );

  return v_row;
end;
$$;
