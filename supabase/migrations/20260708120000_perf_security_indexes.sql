-- Performance + reporting indexes and super-admin aggregation helpers.

create index if not exists invoices_paid_at_idx
  on public.invoices (paid_at desc)
  where status = 'paid' and paid_at is not null;

create or replace function public.super_admin_membership_counts()
returns table (business_id uuid, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select business_id, count(*)::bigint
  from public.user_business_memberships
  group by business_id;
$$;

revoke all on function public.super_admin_membership_counts() from public;
grant execute on function public.super_admin_membership_counts() to service_role;

create or replace function public.super_admin_audit_active_businesses(p_since timestamptz)
returns table (business_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct business_id
  from public.audit_log
  where created_at >= p_since;
$$;

revoke all on function public.super_admin_audit_active_businesses(timestamptz) from public;
grant execute on function public.super_admin_audit_active_businesses(timestamptz) to service_role;

create or replace function public.super_admin_addon_counts()
returns table (business_id uuid, addon_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select business_id, count(*)::bigint
  from public.business_addons
  where status = 'active'
  group by business_id;
$$;

revoke all on function public.super_admin_addon_counts() from public;
grant execute on function public.super_admin_addon_counts() to service_role;

create or replace function public.super_admin_ai_usage_stats_since(p_since timestamptz)
returns table (business_id uuid, total_count bigint, failed_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    business_id,
    count(*)::bigint,
    count(*) filter (
      where coalesce(metadata->>'failed', 'false') = 'true'
        or metadata ? 'error'
    )::bigint
  from public.ai_usage
  where created_at >= p_since
  group by business_id;
$$;

revoke all on function public.super_admin_ai_usage_stats_since(timestamptz) from public;
grant execute on function public.super_admin_ai_usage_stats_since(timestamptz) to service_role;
