-- ============================================================================
-- Bantu Niaga — Post-migration schema grants (local + hosted)
-- ============================================================================
-- Supabase init revokes default privileges from service_role on new tables.
-- Our pillar migrations create many public tables; ensure PostgREST roles
-- can reach them. RLS still scopes tenant data for anon/authenticated.
-- service_role bypasses RLS but still needs table-level GRANTs.
-- ============================================================================

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all routines in schema public to postgres, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;

alter default privileges in schema public
  grant all on tables to postgres, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on sequences to postgres, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, anon;
