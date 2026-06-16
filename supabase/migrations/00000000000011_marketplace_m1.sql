-- Bantu Niaga — Marketplace m1
-- =====================================================================
-- Adds the add-on catalog and per-business activation tables, with a
-- prorated activate/deactivate RPC and a seeded catalog of 8 add-ons.
--
-- Catalog rows live in `public.marketplace_addons` (global, read by
-- everyone). Each business's activation state lives in
-- `public.business_addons` (scoped, RLS-protected).
--
-- The activation flow uses settings_topup_credits's pattern: an atomic
-- SECURITY DEFINER RPC that (1) inserts/updates business_addons,
-- (2) inserts a prorated invoice (if not "included"), and (3) writes
-- an audit_log entry. Deactivation is also done via RPC so the next-
-- cycle effective date is computed consistently.
-- =====================================================================

create table if not exists public.marketplace_addons (
  id          uuid primary key default extensions.uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  short_desc  text not null,
  long_desc   text,
  pillar      text not null check (
    pillar in ('admin','finance','operations','sales','marketing','hr','ai','cross')
  ),
  icon        text not null,        -- lucide icon name
  -- pricing
  price_cents integer not null default 0,
  cadence     text not null default 'monthly' check (
    cadence in ('monthly','yearly','one_time','included')
  ),
  -- bundling
  included_in_tier text[] default '{}'::text[],   -- e.g. ['sme','enterprise']
  -- presentation
  is_featured boolean not null default false,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists public.business_addons (
  id             uuid primary key default extensions.uuid_generate_v4(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  addon_id       uuid not null references public.marketplace_addons(id) on delete restrict,
  status         text not null default 'active' check (
    status in ('active','pending_cancel','cancelled')
  ),
  activated_at   timestamptz not null default now(),
  next_charge_at timestamptz,            -- null when 'included'
  cancel_at      timestamptz,            -- when status='pending_cancel'
  qty            integer not null default 1 check (qty > 0),
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists business_addons_unique_active
  on public.business_addons (business_id, addon_id)
  where status <> 'cancelled';

alter table public.marketplace_addons enable row level security;
alter table public.business_addons   enable row level security;

-- Catalog is public-read for any authenticated session.
create policy marketplace_addons_select_all on public.marketplace_addons
  for select using (true);

-- business_addons follows the standard tenant model (any role of the
-- business can read; only owners can mutate via RPCs below).
create policy business_addons_select on public.business_addons
  for select using (business_id = public.current_business_id());

create policy business_addons_owner_insert on public.business_addons
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() = 'owner'
  );

create policy business_addons_owner_update on public.business_addons
  for update using (
    business_id = public.current_business_id()
    and public.current_role() = 'owner'
  ) with check (
    business_id = public.current_business_id()
    and public.current_role() = 'owner'
  );

-- ---------------------------------------------------------------------
-- RPC: activate add-on (prorated). Inserts business_addons + invoice
-- + audit. Idempotent: if a non-cancelled row already exists, returns it.
-- ---------------------------------------------------------------------
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
  v_proration   integer;
  v_days_left   integer;
  v_days_in_period integer := 30;
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

  -- Bail out if already active for this business.
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

  -- Prorated invoice for monthly/yearly. one_time bills upfront.
  -- "included" cadence => no invoice.
  if v_addon.cadence in ('monthly','yearly','one_time')
     and v_addon.price_cents > 0
     and not (v_addon.included_in_tier @> array[v_business.tier]) then

    if v_addon.cadence = 'monthly' then
      v_days_left := greatest(0, 30 -
        extract(day from age(now(), coalesce(v_business.subscription_renewal_at - interval '30 days', now())))::int
      );
      v_proration := (v_addon.price_cents::numeric * v_days_left / 30)::int * greatest(1, p_qty);
    elsif v_addon.cadence = 'yearly' then
      v_proration := v_addon.price_cents * greatest(1, p_qty);
    else
      v_proration := v_addon.price_cents * greatest(1, p_qty);
    end if;

    v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        substr(extensions.uuid_generate_v4()::text, 1, 6);

    insert into public.invoices (business_id, number, kind, amount_cents, currency, status, issued_at, paid_at, meta)
    values (
      v_business_id, v_invoice_number, 'addon', v_proration, 'MYR', 'paid', now(), now(),
      jsonb_build_object(
        'addon_slug', v_addon.slug,
        'addon_name', v_addon.name,
        'qty',        greatest(1, p_qty),
        'proration',  v_proration < (v_addon.price_cents * greatest(1, p_qty))
      )
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

-- ---------------------------------------------------------------------
-- RPC: deactivate add-on. Marks pending_cancel + sets cancel_at to
-- next_charge_at (or now() if no next charge).
-- ---------------------------------------------------------------------
create or replace function public.marketplace_deactivate_addon(
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
     set status      = 'pending_cancel',
         cancel_at   = coalesce(next_charge_at, now()),
         updated_at  = now()
   where business_id = v_business_id
     and addon_id    = v_addon.id
     and status      = 'active'
   returning * into v_row;

  if not found then
    raise exception 'addon is not active';
  end if;

  insert into public.audit_log (business_id, actor_user_id, action, entity_type, entity_id, diff)
  values (
    v_business_id, v_user_id, 'marketplace.deactivate', 'addon', v_row.id,
    jsonb_build_object('slug', v_addon.slug, 'cancel_at', v_row.cancel_at)
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Seed the catalog.
-- ---------------------------------------------------------------------
insert into public.marketplace_addons
  (slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, included_in_tier, is_featured, sort_order)
values
  ('whatsapp-business',
   'WhatsApp Business API',
   'Send broadcasts, automate replies, and let Maya post to your Business catalog.',
   'Tier-1 official channel via Meta. Bundles 1,000 free monthly outbound conversations + receipts on every order.',
   'marketing', 'message-circle', 3500, 'monthly', '{}', true, 10),

  ('extra-seat',
   'Extra staff seat',
   'Add another team member beyond your tier. Includes role permissions and audit trail.',
   'Each extra seat gets the same role assignment options as your tier defaults: cashier, marketing, finance, manager.',
   'admin', 'user-plus', 1500, 'monthly', '{}', false, 20),

  ('storage-10gb',
   'Extra 10 GB storage',
   'Receipts, contracts, content uploads — stays in the Singapore region.',
   'Hard limit raised by 10 GB. Soft warning at 80% usage. Storage usage shows in Settings → Billing.',
   'cross', 'database', 800, 'monthly', '{}', false, 30),

  ('boost-credits-300',
   'Boost Credits · 300',
   'Top up the credit pool used by Maya, Operations AI, and Boardroom.',
   '300 credits ≈ a month of heavy AI use. Credits never expire and apply to every AI agent in the platform.',
   'ai', 'zap', 5000, 'one_time', '{}', false, 40),

  ('tiktok-sync',
   'TikTok Shop sync',
   'Import orders + customers, auto-tag VIP buyers, schedule Spark Ads from the Content Calendar.',
   'Two-way sync every 15 minutes. Reads orders, refunds, products. Writes campaigns from Content Calendar.',
   'marketing', 'music', 2500, 'monthly', '{}', false, 50),

  ('lhdn-einvoice',
   'LHDN e-Invoice connector',
   'MyInvois submission for every Finance invoice. Mandatory for businesses with >RM 25m revenue.',
   'Production cert via your tax agent. Submission status surfaced on each invoice. Resubmission supported.',
   'finance', 'file-check', 0, 'included', '{"sme","enterprise"}', false, 60),

  ('boardroom-weekly',
   'Boardroom AI weekly digest',
   'Sunday morning report on every pillar — revenue, churn, payroll alerts, low-stock, content insights.',
   'Auto-emailed to all owners every Sunday 7 AM Malaysia time. Includes one prioritised action per pillar.',
   'ai', 'sparkles', 2000, 'monthly', '{}', false, 70),

  ('shopee-sync',
   'Shopee Mall sync',
   'Sync Shopee orders → Operations queue + Marketing customers. Auto-print waybills from POS.',
   'Daily reconciliation against bank settlement. Supports SLS, J&T, and DHL pickup integrations.',
   'sales', 'shopping-bag', 2500, 'monthly', '{}', false, 80)
on conflict (slug) do update set
  name             = excluded.name,
  short_desc       = excluded.short_desc,
  long_desc        = excluded.long_desc,
  pillar           = excluded.pillar,
  icon             = excluded.icon,
  price_cents      = excluded.price_cents,
  cadence          = excluded.cadence,
  included_in_tier = excluded.included_in_tier,
  is_featured      = excluded.is_featured,
  sort_order       = excluded.sort_order;

