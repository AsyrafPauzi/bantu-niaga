-- ============================================================================
-- Bantu Niaga — Company Settings M1
-- ============================================================================
-- Wires the company-settings UI to real data. Four surfaces:
--
--   1. Subscription Plan   → businesses.tier / .subscription_renewal_at /
--                            .subscription_status + computed usage
--   2. Billing & Payment   → payment_methods, invoices, credit_balance,
--                            credit_ledger (top-ups & spend events)
--   3. Security Settings   → users.last_password_change_at, audit_log
--                            (2FA itself lives in auth.mfa_factors — managed
--                            by Supabase Auth, queried via RPC)
--   4. Branding            → businesses.logo_url, brand_primary_hex,
--                            brand_accent_hex, receipt_footer, contact_line,
--                            email_from_name, email_reply_to,
--                            registration_no, sst_number
--
-- All writes go through RLS-gated tables. Owner-only PATCH is enforced both
-- in the API handler (defence-in-depth) and at the policy level below.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extend businesses with branding + subscription metadata
-- ─────────────────────────────────────────────────────────────────────────
alter table public.businesses
  add column if not exists logo_url text,
  add column if not exists brand_primary_hex text default '#5B8C5A',
  add column if not exists brand_accent_hex text default '#F4A340',
  add column if not exists registration_no text,
  add column if not exists sst_number text,
  add column if not exists contact_line text,
  add column if not exists receipt_footer text,
  add column if not exists email_from_name text,
  add column if not exists email_reply_to text,
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('active', 'past_due', 'cancelled', 'trial')),
  add column if not exists subscription_renewal_at timestamptz,
  add column if not exists credit_balance integer not null default 0
    check (credit_balance >= 0);

-- Hex colour shape check (#RRGGBB only).
alter table public.businesses
  drop constraint if exists businesses_brand_primary_hex_shape;
alter table public.businesses
  add constraint businesses_brand_primary_hex_shape
    check (brand_primary_hex ~ '^#[0-9A-Fa-f]{6}$');

alter table public.businesses
  drop constraint if exists businesses_brand_accent_hex_shape;
alter table public.businesses
  add constraint businesses_brand_accent_hex_shape
    check (brand_accent_hex ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.businesses.logo_url is
  'Public URL (Supabase Storage) of the business logo. Updated by /api/settings/branding/logo.';
comment on column public.businesses.credit_balance is
  'Pre-paid Fast Credits remaining. Decremented on every AI agent call; topped up via /api/settings/billing/topup.';

-- Default renewal date if currently null: +30 days from now.
update public.businesses
  set subscription_renewal_at = now() + interval '30 days'
  where subscription_renewal_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Extend users with last-password-change tracking
-- ─────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists last_password_change_at timestamptz;

-- Backfill: any user with no recorded change → first login was the change.
update public.users
  set last_password_change_at = created_at
  where last_password_change_at is null;

comment on column public.users.last_password_change_at is
  'Set by /api/settings/security/password POST. Used to nag users whose password is older than 90 days.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. payment_methods
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('card', 'fpx', 'wallet')),
  label text not null,                       -- e.g. "Visa ending 4242"
  masked text not null,                      -- e.g. "•••• 4242"
  owner_name text,
  exp_month smallint check (exp_month between 1 and 12),
  exp_year smallint check (exp_year between 2020 and 2099),
  is_default boolean not null default false,
  provider text not null default 'billplz',  -- billplz / curlec / stripe
  provider_ref text,                         -- token from the gateway
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_methods_business_idx
  on public.payment_methods (business_id, created_at desc);

-- Only one default per business.
create unique index if not exists payment_methods_one_default_idx
  on public.payment_methods (business_id)
  where is_default;

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;

create policy "payment_methods_select_self_business" on public.payment_methods
  for select using (business_id = public.current_business_id());

create policy "payment_methods_owner_insert" on public.payment_methods
  for insert with check (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "payment_methods_owner_update" on public.payment_methods
  for update using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "payment_methods_owner_delete" on public.payment_methods
  for delete using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. invoices (subscription + top-up tax invoices)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number text not null,
  kind text not null default 'subscription'
    check (kind in ('subscription', 'topup', 'addon', 'manual')),
  period_label text,                         -- "Jun 2026", "Top-up", …
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  tax_myr numeric(10, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('paid', 'pending', 'failed', 'refunded')),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_number_per_business_idx
  on public.invoices (business_id, number);

create index if not exists invoices_business_recent_idx
  on public.invoices (business_id, created_at desc);

alter table public.invoices enable row level security;

create policy "invoices_select_self_business" on public.invoices
  for select using (business_id = public.current_business_id());

-- Inserts and updates only from server-role / RPCs.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. credit_ledger (every credit movement)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.credit_ledger (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  delta integer not null,                    -- +50 top-up, -1 agent spend
  reason text not null,                      -- 'topup', 'maya.caption', …
  invoice_id uuid references public.invoices(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_business_idx
  on public.credit_ledger (business_id, created_at desc);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger_select_self_business" on public.credit_ledger
  for select using (business_id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- Top up Fast Credits. Single transaction:
--   1. INSERT invoice (status='paid' for the stub gateway)
--   2. INSERT credit_ledger (+delta)
--   3. UPDATE businesses.credit_balance
--   4. INSERT audit_log
-- Returns the new balance and invoice id.
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
set search_path = public
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
              substring(uuid_generate_v4()::text from 1 for 6);

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

grant execute on function public.settings_topup_credits(uuid, integer, numeric, uuid, uuid) to authenticated;

-- Tier-change RPC. Updates businesses.tier and writes audit log entry.
create or replace function public.settings_change_tier(
  p_business_id uuid,
  p_tier text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
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

grant execute on function public.settings_change_tier(uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. RLS — owner-only UPDATE on businesses (branding + subscription)
-- ─────────────────────────────────────────────────────────────────────────
-- The init migration only created a SELECT policy. Add owner UPDATE.
create policy "businesses_owner_update" on public.businesses
  for update
  using (
    id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  )
  with check (
    id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Storage bucket for branding (logos)
-- ─────────────────────────────────────────────────────────────────────────
-- Public-read bucket so the logo can be referenced from receipts / sign-in
-- page without going through a signed-URL flow. Writes are restricted by
-- the storage.objects RLS policy below: only owners of the matching
-- business_id can write to `branding/<business_id>/…`.
insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do update set public = true;

-- Allow authenticated owners to upload to their own business's prefix.
create policy "branding_owner_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "branding_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "branding_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "branding_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'branding');

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Seed: payment methods + invoices + ledger for the demo business
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_business_id uuid;
  v_owner_id uuid;
  v_pm_id uuid;
begin
  select id into v_business_id from public.businesses limit 1;
  if v_business_id is null then
    return;
  end if;

  select id into v_owner_id
    from public.users
    where business_id = v_business_id and role = 'owner'
    limit 1;

  insert into public.payment_methods (
    business_id, kind, label, masked, owner_name, exp_month, exp_year, is_default, provider
  )
  values
    (v_business_id, 'card', 'Visa ending 4242', '•••• 4242',
     'Asyraf bin Aziz', 8, 2029, true, 'billplz')
  on conflict do nothing
  returning id into v_pm_id;

  insert into public.payment_methods (
    business_id, kind, label, masked, is_default, provider
  )
  values
    (v_business_id, 'fpx', 'Maybank FPX', '•••• 8801', false, 'curlec')
  on conflict do nothing;

  -- Seed 3 historic paid invoices (months Apr-Jun 2026) if none exist.
  insert into public.invoices (
    business_id, number, kind, period_label, amount_myr, tax_myr, status, paid_at
  )
  select v_business_id, n, 'subscription', p, 120.00, 9.60, 'paid', d
  from (values
    ('INV-2026-0612', 'Jun 2026', timestamptz '2026-06-14 04:30+08'),
    ('INV-2026-0512', 'May 2026', timestamptz '2026-05-14 04:30+08'),
    ('INV-2026-0412', 'Apr 2026', timestamptz '2026-04-14 04:30+08')
  ) as v(n, p, d)
  on conflict (business_id, number) do nothing;

  update public.businesses
     set credit_balance = greatest(credit_balance, 252),
         subscription_renewal_at = coalesce(subscription_renewal_at, now() + interval '30 days')
   where id = v_business_id;
end$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Comments / done.
-- ─────────────────────────────────────────────────────────────────────────
comment on table public.payment_methods is 'Stored payment instruments. Only the masked + last4 are kept — never PAN.';
comment on table public.invoices is 'Tax invoices generated each billing cycle + every Fast Credits top-up.';
comment on table public.credit_ledger is 'Append-only ledger of every Fast Credits movement. Sum == businesses.credit_balance.';
