-- ============================================================================
-- Bantu Niaga — HR Assistant platform (credits, settings, notices, metering)
-- ============================================================================

-- ── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.business_agent_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  display_name text not null default 'Hana',
  assistant_enabled boolean not null default true,
  daily_notice_enabled boolean not null default true,
  daily_notice_hour smallint not null default 7
    check (daily_notice_hour between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, agent_slug)
);

create index if not exists business_agent_settings_business_idx
  on public.business_agent_settings (business_id, agent_slug);

drop trigger if exists business_agent_settings_set_updated_at on public.business_agent_settings;
create trigger business_agent_settings_set_updated_at
  before update on public.business_agent_settings
  for each row execute function public.set_updated_at();

create table if not exists public.agent_daily_notices (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  notice_date date not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (business_id, agent_slug, notice_date)
);

create index if not exists agent_daily_notices_business_date_idx
  on public.agent_daily_notices (business_id, agent_slug, notice_date desc);

create table if not exists public.ai_usage (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  trigger_type text not null,
  credits_charged integer not null default 0,
  mode text not null default 'fast' check (mode in ('fast', 'slow')),
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_myr_estimated numeric(10, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_business_created_idx
  on public.ai_usage (business_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.business_agent_settings enable row level security;
alter table public.agent_daily_notices enable row level security;
alter table public.ai_usage enable row level security;

create policy business_agent_settings_select_tenant
  on public.business_agent_settings for select
  using (business_id = public.current_business_id());

create policy business_agent_settings_insert_hr
  on public.business_agent_settings for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

create policy business_agent_settings_update_hr
  on public.business_agent_settings for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

create policy agent_daily_notices_select_tenant
  on public.agent_daily_notices for select
  using (business_id = public.current_business_id());

create policy ai_usage_select_tenant
  on public.ai_usage for select
  using (business_id = public.current_business_id());

-- ── Credit grant (no invoice) ──────────────────────────────────────────────

create or replace function public.settings_grant_credits(
  p_business_id uuid,
  p_credits integer,
  p_reason text,
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  insert into public.credit_ledger (business_id, delta, reason, actor_user_id)
  values (p_business_id, p_credits, p_reason, p_actor_user_id);

  update public.businesses
     set credit_balance = credit_balance + p_credits
   where id = p_business_id
   returning credit_balance into v_balance;

  return v_balance;
end;
$$;

grant execute on function public.settings_grant_credits(uuid, integer, text, uuid)
  to authenticated, service_role;

-- ── Credit spend (fast / slow mode) ─────────────────────────────────────────

create or replace function public.settings_spend_credits(
  p_business_id uuid,
  p_credits integer,
  p_reason text,
  p_actor_user_id uuid default null,
  p_allow_slow boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
  v_charged integer := 0;
  v_mode text := 'fast';
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  select credit_balance into v_balance
    from public.businesses
   where id = p_business_id
   for update;

  if not found then
    raise exception 'business not found';
  end if;

  if v_balance >= p_credits then
    v_charged := p_credits;
    v_mode := 'fast';
    insert into public.credit_ledger (business_id, delta, reason, actor_user_id)
    values (p_business_id, -p_credits, p_reason, p_actor_user_id);
    update public.businesses
       set credit_balance = credit_balance - p_credits
     where id = p_business_id
     returning credit_balance into v_balance;
  elsif p_allow_slow then
    v_charged := 0;
    v_mode := 'slow';
  else
    raise exception 'insufficient_credits';
  end if;

  return jsonb_build_object(
    'charged', v_charged,
    'mode', v_mode,
    'new_balance', v_balance
  );
end;
$$;

grant execute on function public.settings_spend_credits(uuid, integer, text, uuid, boolean)
  to authenticated, service_role;

-- ── AI usage log (server-side only) ─────────────────────────────────────────

create or replace function public.record_ai_usage(
  p_business_id uuid,
  p_agent_slug text,
  p_trigger_type text,
  p_credits_charged integer,
  p_mode text,
  p_tokens_in integer default 0,
  p_tokens_out integer default 0,
  p_cost_myr_estimated numeric default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.ai_usage (
    business_id, agent_slug, trigger_type, credits_charged, mode,
    tokens_in, tokens_out, cost_myr_estimated, metadata
  )
  values (
    p_business_id, p_agent_slug, p_trigger_type, p_credits_charged, p_mode,
    p_tokens_in, p_tokens_out, p_cost_myr_estimated, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.record_ai_usage(
  uuid, text, text, integer, text, integer, integer, numeric, jsonb
) to authenticated, service_role;

-- ── Marketplace addon seed ───────────────────────────────────────────────────

insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order, is_featured
)
values (
  'hr-assistant',
  'HR Assistant (Hana)',
  'AI HR staff — leave, team summaries, daily notices',
  'Chat with Hana about your team. 100 AI credits/month included. Record MC and annual leave by asking in plain language.',
  'hr',
  'users',
  2000,
  'monthly',
  15,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  price_cents = excluded.price_cents,
  is_featured = excluded.is_featured;

-- ── Extend marketplace activation for HR Assistant ───────────────────────────

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

  if p_addon_slug = 'hr-assistant' then
    perform public.settings_grant_credits(
      v_business_id, 100, 'hr_assistant_monthly_grant', v_user_id
    );

    insert into public.business_agent_settings (
      business_id, agent_slug, display_name, assistant_enabled, daily_notice_enabled
    )
    values (v_business_id, 'hr', 'Hana', true, true)
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

-- ── Monthly renewal grant for HR Assistant ───────────────────────────────────

create or replace function public.hr_assistant_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select ba.id, ba.business_id, ba.next_charge_at
      from public.business_addons ba
      join public.marketplace_addons ma on ma.id = ba.addon_id
     where ma.slug = 'hr-assistant'
       and ba.status = 'active'
       and ba.next_charge_at is not null
       and ba.next_charge_at <= now()
  loop
    perform public.settings_grant_credits(
      v_row.business_id, 100, 'hr_assistant_monthly_grant', null
    );

    update public.business_addons
       set next_charge_at = now() + interval '30 days',
           updated_at = now()
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.hr_assistant_process_renewals() to service_role;
