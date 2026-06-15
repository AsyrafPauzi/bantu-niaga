-- ============================================================================
-- Bantu Niaga — Marketing v1.1, Phase 2A: coupons + coupon_redemptions
-- ============================================================================
-- Lands the coupons portion of the v1.1 spec
-- (docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md
--  §3, §7). Pairs with the segments migration (00000000000020) and runs in
-- parallel with the broadcasts migration (00000000000023). The broadcasts
-- worker deliberately does NOT add a foreign-key constraint on
-- `broadcasts.coupon_id → coupons.id`; a follow-up migration can promote it
-- once both surfaces are live in every environment.
--
-- What lands here:
--   1. public.coupons — one row per promotion code per business.
--      PCT (percentage) or AMT (ringgit-off). Soft-deletable via deleted_at.
--   2. public.coupon_redemptions — one row per successful coupon application
--      against an order. Cashier role can INSERT (POS forward-compat).
--   3. Indexes on (business_id, status) for the active-list view and
--      (coupon_id, redeemed_at desc) for the redemption-log table.
--   4. RLS per spec §3 RLS contract:
--        - coupons: SELECT same biz + deleted_at IS NULL;
--          INSERT/UPDATE owner+manager; no DELETE (soft-delete via UPDATE).
--        - coupon_redemptions: SELECT same biz via parent coupon;
--          INSERT for owner OR manager OR cashier; no UPDATE/DELETE.
--   5. set_updated_at trigger on coupons.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- coupons
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,

  code                text not null check (length(code) between 3 and 32),
  name                text check (name is null or length(name) between 1 and 120),
  type                text not null check (type in ('PCT', 'AMT')),
  value               numeric(10,2) not null check (value > 0),
  -- PCT: 0 < value <= 100. AMT: any positive ringgit. Enforced here AND
  -- in the API validation layer (see lib/marketing/coupons.ts).
  constraint coupons_pct_value_range
    check (type <> 'PCT' or (value > 0 and value <= 100)),

  min_subtotal_myr    numeric(10,2) not null default 0
                      check (min_subtotal_myr >= 0),
  valid_from          timestamptz not null default now(),
  valid_until         timestamptz,        -- null = no expiry
  total_limit         integer check (total_limit is null or total_limit > 0),
  per_customer_limit  integer not null default 1
                      check (per_customer_limit >= 0),

  -- Optional cohort scope. on delete set null mirrors the spec wording
  -- (deleting a segment deactivates its coupon scope rather than the
  -- coupon itself).
  segment_id          uuid references public.customer_segments(id) on delete set null,

  status              text not null default 'active'
                      check (status in ('active', 'paused', 'expired')),
  redeemed_count      integer not null default 0
                      check (redeemed_count >= 0),

  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Case-insensitive uniqueness per business so "raya20" and "RAYA20"
-- collide. The functional unique index also accelerates the
-- lookup-by-code path used by validate/redeem.
-- (Spec §3 calls for `unique (business_id, lower(code))`; Postgres
-- only supports lower() in unique indexes, not table-level
-- constraints, so we declare it as an index here.)
create unique index if not exists coupons_business_code_lower_unique_idx
  on public.coupons (business_id, lower(code));

comment on table public.coupons is
  'Promotion codes. PCT (percentage off) or AMT (ringgit off) per spec §3. Soft-deleted via deleted_at; status transitions (active ↔ paused ↔ expired) live in the API.';
comment on column public.coupons.code is
  'Display code as the operator typed it. Uniqueness is case-insensitive — see the functional unique index.';
comment on column public.coupons.segment_id is
  'Optional cohort scope. When set, the validate/redeem path requires the customer to belong to this segment.';

create index if not exists coupons_business_status_idx
  on public.coupons (business_id, status);

create index if not exists coupons_business_deleted_idx
  on public.coupons (business_id, deleted_at);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;

-- SELECT: same business; soft-deleted rows excluded by default.
drop policy if exists "coupons_select_self_business" on public.coupons;
create policy "coupons_select_self_business" on public.coupons
  for select
  using (
    business_id = public.current_business_id()
    and deleted_at is null
  );

-- INSERT: owner/manager only.
drop policy if exists "coupons_insert_self_business" on public.coupons;
create policy "coupons_insert_self_business" on public.coupons
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- UPDATE: owner/manager only. The set_updated_at trigger handles the
-- timestamp; the API enforces "code is immutable" (see PATCH route).
-- The redemption increment goes through here too — owner/manager can
-- bump redeemed_count, and cashier writes increment via the SQL
-- function below (security-definer) so we don't need to widen the
-- write policy.
drop policy if exists "coupons_update_self_business" on public.coupons;
create policy "coupons_update_self_business" on public.coupons
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
  );

-- No DELETE policy: rows are soft-deleted via UPDATE deleted_at.

-- ─────────────────────────────────────────────────────────────────────────
-- coupon_redemptions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.coupon_redemptions (
  id                    uuid primary key default gen_random_uuid(),
  coupon_id             uuid not null references public.coupons(id) on delete restrict,
  customer_id           uuid references public.customers(id) on delete set null,
  order_ref             text,                -- free-form: future POS sale_id, invoice_id, etc.
  discount_amount_myr   numeric(10,2) not null check (discount_amount_myr > 0),
  redeemed_by           uuid references auth.users(id) on delete set null,
  redeemed_at           timestamptz not null default now()
);

comment on table public.coupon_redemptions is
  'One row per successful coupon application against an order. order_ref is free-form so the future POS / invoicing surfaces can correlate without schema migrations.';

-- Idempotency anchor for the redeem API. When `order_ref` is provided
-- the API short-circuits on conflict; when null, the API creates a new
-- row every time (the "tap apply" code path). The partial-index trick
-- enforces uniqueness only when order_ref is non-null, matching the
-- spec wording ("idempotent on (coupon_id, order_ref) when order_ref
-- is provided").
create unique index if not exists coupon_redemptions_coupon_order_unique
  on public.coupon_redemptions (coupon_id, order_ref)
  where order_ref is not null;

create index if not exists coupon_redemptions_coupon_redeemed_idx
  on public.coupon_redemptions (coupon_id, redeemed_at desc);

create index if not exists coupon_redemptions_customer_idx
  on public.coupon_redemptions (customer_id);

alter table public.coupon_redemptions enable row level security;

-- SELECT: same business via parent coupon. The parent's business_id
-- carries the tenant scope; this policy mirrors the broadcasts/
-- broadcast_recipients pattern.
drop policy if exists "coupon_redemptions_select_via_parent" on public.coupon_redemptions;
create policy "coupon_redemptions_select_via_parent" on public.coupon_redemptions
  for select
  using (
    exists (
      select 1
      from public.coupons c
      where c.id = coupon_redemptions.coupon_id
        and c.business_id = public.current_business_id()
    )
  );

-- INSERT: owner OR manager OR cashier. The cashier carve-out is the
-- forward-compat plumbing for the future POS — see spec §7. The parent
-- coupon's business_id MUST match the caller's business_id; we verify
-- via EXISTS so a malicious cashier can't insert against another
-- tenant's coupon by guessing its UUID.
drop policy if exists "coupon_redemptions_insert_via_parent" on public.coupon_redemptions;
create policy "coupon_redemptions_insert_via_parent" on public.coupon_redemptions
  for insert
  with check (
    public.current_role() in ('owner', 'manager', 'cashier')
    and exists (
      select 1
      from public.coupons c
      where c.id = coupon_redemptions.coupon_id
        and c.business_id = public.current_business_id()
        and c.deleted_at is null
    )
  );

-- No UPDATE / DELETE policies: redemptions are append-only audit trail.

-- ─────────────────────────────────────────────────────────────────────────
-- public.increment_coupon_redeemed_count(coupon_id uuid)
--
-- Atomic counter bump used by the redeem API. Returns the new count.
-- Security-definer so cashier callers (who can INSERT into
-- coupon_redemptions but not UPDATE coupons) can still bump the
-- counter without us having to widen the coupons UPDATE policy.
--
-- The function does its own tenant check: it refuses to bump unless
-- the calling user belongs to the same business as the coupon.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.increment_coupon_redeemed_count(p_coupon_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  if not exists (
    select 1
    from public.coupons c
    where c.id = p_coupon_id
      and c.business_id = public.current_business_id()
      and c.deleted_at is null
  ) then
    raise exception 'coupon not found or out of tenant scope'
      using errcode = '42501';
  end if;

  update public.coupons
     set redeemed_count = redeemed_count + 1
   where id = p_coupon_id
   returning redeemed_count into v_new_count;

  return v_new_count;
end;
$$;

grant execute on function public.increment_coupon_redeemed_count(uuid) to authenticated;
