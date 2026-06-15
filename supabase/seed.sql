-- ============================================================================
-- Bantu Niaga — local/dev seed
-- ============================================================================
-- Idempotent. Re-running this file leaves the DB in the same state.
--
-- Seeds the demo business row that scripts/seed-owner.ts links its
-- auth-created owner user to. The owner row itself MUST be inserted by
-- the Node script (Supabase Auth manages auth.users; SQL can't create
-- an auth user with a password).
-- ============================================================================

insert into public.businesses (
  id, idcompany, name, state_code, tier,
  sst_enabled, sst_rate_pct,
  invoice_number_prefix, invoice_number_year_reset
)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo',
  'Bantu Niaga Demo SDN BHD',
  'KUL',
  'enterprise',
  false, 0,
  'INV', true
)
on conflict (id) do update set
  idcompany = excluded.idcompany,
  name = excluded.name,
  state_code = excluded.state_code,
  tier = excluded.tier;
