-- Expand team roles: marketing_officer, operations_officer, sales_rep.
-- Mirrors lib/permissions.ts — specialist roles between Manager and front-line staff.

-- ── RBAC helpers ───────────────────────────────────────────────────────────
create or replace function public.role_can_marketing_rw()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'manager', 'marketing_officer');
$$;

create or replace function public.role_can_operations_rw()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('owner', 'manager', 'operations_officer');
$$;

grant execute on function public.role_can_marketing_rw() to authenticated;
grant execute on function public.role_can_operations_rw() to authenticated;

-- ── users.role + team_invites.role checks ──────────────────────────────────
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in (
  'owner', 'manager', 'accountant', 'hr_officer', 'cashier', 'staff',
  'marketing_officer', 'operations_officer', 'sales_rep'
));

alter table public.team_invites drop constraint if exists team_invites_role_check;
alter table public.team_invites add constraint team_invites_role_check check (role in (
  'manager', 'accountant', 'hr_officer', 'cashier', 'staff',
  'marketing_officer', 'operations_officer', 'sales_rep'
));

-- ── super-admin RPC ────────────────────────────────────────────────────────
create or replace function public.super_admin_set_user_role(
  p_user_id uuid,
  p_role    text
) returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.users%rowtype;
  v_old text;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  if p_role not in (
    'owner', 'manager', 'accountant', 'hr_officer', 'cashier', 'staff',
    'marketing_officer', 'operations_officer', 'sales_rep'
  ) then
    raise exception 'invalid role: %', p_role;
  end if;

  select role into v_old from public.users where id = p_user_id;
  update public.users set role = p_role, updated_at = now()
   where id = p_user_id returning * into v_row;
  if not found then raise exception 'user not found'; end if;

  insert into public.super_admin_audit (admin_user_id, admin_email, action, target_type, target_id, target_business_id, diff)
  values (v_actor,
          (select email from public.platform_admins where user_id=v_actor limit 1),
          'user.set_role', 'user', p_user_id::text, v_row.business_id,
          jsonb_build_object('from', v_old, 'to', p_role));
  return v_row;
end;
$$;

-- ── Marketing RLS — widen write access for marketing_officer ───────────────
drop policy if exists "customers_insert_self_business" on public.customers;
create policy "customers_insert_self_business" on public.customers
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "customers_update_self_business" on public.customers;
create policy "customers_update_self_business" on public.customers
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  )
  with check (business_id = public.current_business_id());

drop policy if exists "customers_delete_self_business" on public.customers;
create policy "customers_delete_self_business" on public.customers
  for delete using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "csv_imports_self_business" on public.customer_csv_imports;
create policy "csv_imports_self_business" on public.customer_csv_imports
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "content_plan_self_business" on public.content_plan;
create policy "content_plan_self_business" on public.content_plan
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "content_plan_media_self_business" on public.content_plan_media;
create policy "content_plan_media_self_business" on public.content_plan_media
  for all
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "customer_segments_insert_self_business" on public.customer_segments;
create policy "customer_segments_insert_self_business" on public.customer_segments
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
    and kind = 'custom'
  );

drop policy if exists "customer_segments_update_self_business" on public.customer_segments;
create policy "customer_segments_update_self_business" on public.customer_segments
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
    and kind = 'custom'
  )
  with check (
    business_id = public.current_business_id()
    and kind = 'custom'
  );

drop policy if exists "broadcasts_insert_self_business" on public.broadcasts;
create policy "broadcasts_insert_self_business" on public.broadcasts
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "broadcasts_update_self_business" on public.broadcasts;
create policy "broadcasts_update_self_business" on public.broadcasts
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  )
  with check (business_id = public.current_business_id());

drop policy if exists "coupons_insert_self_business" on public.coupons;
create policy "coupons_insert_self_business" on public.coupons
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "coupons_update_self_business" on public.coupons;
create policy "coupons_update_self_business" on public.coupons
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  )
  with check (business_id = public.current_business_id());

drop policy if exists "marketing_files_insert_self_business" on public.marketing_files;
create policy "marketing_files_insert_self_business" on public.marketing_files
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

drop policy if exists "marketing_files_update_self_business" on public.marketing_files;
create policy "marketing_files_update_self_business" on public.marketing_files
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_marketing_rw()
  );

-- ── Operations RLS — widen write access for operations_officer ─────────────
drop policy if exists "operations_suppliers_insert" on public.operations_suppliers;
create policy "operations_suppliers_insert" on public.operations_suppliers
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_suppliers_update" on public.operations_suppliers;
create policy "operations_suppliers_update" on public.operations_suppliers
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_orders_insert" on public.operations_orders;
create policy "operations_orders_insert" on public.operations_orders
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_orders_update" on public.operations_orders;
create policy "operations_orders_update" on public.operations_orders
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_products_insert" on public.operations_products;
create policy "operations_products_insert" on public.operations_products
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_products_update" on public.operations_products;
create policy "operations_products_update" on public.operations_products
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_booking_resources_insert" on public.operations_booking_resources;
create policy "operations_booking_resources_insert" on public.operations_booking_resources
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_booking_resources_update" on public.operations_booking_resources;
create policy "operations_booking_resources_update" on public.operations_booking_resources
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_bookings_insert" on public.operations_bookings;
create policy "operations_bookings_insert" on public.operations_bookings
  for insert with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );

drop policy if exists "operations_bookings_update" on public.operations_bookings;
create policy "operations_bookings_update" on public.operations_bookings
  for update
  using (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  )
  with check (
    business_id = public.current_business_id()
    and public.role_can_operations_rw()
  );
