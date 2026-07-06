-- ============================================================================
-- Bantu Niaga — customer analytics view security hardening
-- ============================================================================
-- Supabase advisor flags SECURITY DEFINER views because they can evaluate
-- permissions/RLS as the view owner instead of the querying tenant user.
-- Keep this tenant-facing analytics view in public, but force invoker
-- semantics so the underlying customers RLS applies to the caller.
-- ============================================================================

alter view public.customer_analytics_v1
  set (security_invoker = true);

comment on view public.customer_analytics_v1 is
  'M6 per-business segment counts for the /marketing landing KPI cards. Security invoker view; RLS on the underlying customers table scopes the SELECT to the caller business.';
