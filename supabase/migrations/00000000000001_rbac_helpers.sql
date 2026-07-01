F-- ============================================================================
-- Bantu Niaga — RBAC SQL helpers
-- ============================================================================
-- Phase 0 RBAC plumbing inside Postgres. Companion to:
--   - lib/permissions.ts  (single source of truth, 6×6 matrix)
--   - middleware.ts       (Next.js API fast-fail layer)
--   - <RequirePermission> (UI hide layer)
--
-- This migration only ships *helpers and templates*. Per-pillar tables and
-- their concrete RLS policies land in their own migrations as each pillar's
-- Phase work begins.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- public.current_role()
--
-- Returns the calling user's role from public.users. Stable + security-
-- definer so policies can call it without recursion.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

grant execute on function public.current_role() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- public.current_user_has_full_access(area)
--
-- Coarse helper: true iff the caller is an Owner or Manager.
--
-- This intentionally mirrors the `'*'` rows in lib/permissions.ts for
-- v0 — Owners and Managers have full access to every pillar. Per-area
-- nuance (e.g. Manager has no `billing` access; Accountant has finance
-- only) is enforced in the *application layer* and in the *per-table*
-- policies, not in this helper. Keep this function dumb on purpose.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.current_user_has_full_access(area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('owner', 'manager')
  )
$$;

grant execute on function public.current_user_has_full_access(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Policy templates for future per-pillar tables
--
-- Copy/paste these blocks into the migration that creates the new table.
-- They cover the three patterns we'll repeat over and over:
--
--   1. Tenant isolation (every row scoped to current_business_id())
--   2. Pillar-level access gating on writes
--   3. Row-level scope (e.g. staff sees only assigned rows)
--
-- DO NOT uncomment these here — they reference tables that don't exist
-- yet. They are intentionally inert templates.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Template 1: SELECT — rows belonging to my business ────────────────────
-- create policy "<table>_select_self_business"
--   on public.<table>
--   for select
--   using (business_id = public.current_business_id());

-- ── Template 2: INSERT/UPDATE/DELETE — my business AND area access ────────
-- Replace `'finance'` with whichever pillar this table belongs to. The
-- coarse `current_user_has_full_access` is fine for Owner/Manager-only
-- tables; for finer pillar gating, extend this helper or inline the role
-- check (e.g. `current_role() in ('owner','manager','accountant')`).
--
-- create policy "<table>_write_self_business"
--   on public.<table>
--   for insert
--   with check (
--     business_id = public.current_business_id()
--     and public.current_user_has_full_access('finance')
--   );
--
-- create policy "<table>_update_self_business"
--   on public.<table>
--   for update
--   using (business_id = public.current_business_id())
--   with check (
--     business_id = public.current_business_id()
--     and public.current_user_has_full_access('finance')
--   );
--
-- create policy "<table>_delete_self_business"
--   on public.<table>
--   for delete
--   using (
--     business_id = public.current_business_id()
--     and public.current_user_has_full_access('finance')
--   );

-- ── Template 3: Row-level scope — `staff` sees only assigned rows ────────
-- For a hypothetical `tasks` table where Staff users may only read tasks
-- assigned to them, while Owners/Managers see everything in the business:
--
-- create policy "tasks_select_assigned_only"
--   on public.tasks
--   for select
--   using (
--     business_id = public.current_business_id()
--     and (
--       public.current_role() in ('owner', 'manager')
--       or assignee_user_id = auth.uid()
--     )
--   );
