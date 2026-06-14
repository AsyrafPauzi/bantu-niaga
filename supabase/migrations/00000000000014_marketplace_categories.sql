-- ============================================================================
-- 00000000000014_marketplace_categories.sql
--
-- Marketplace catalog cleanup:
--   1. Re-classify the "Extra 10 GB storage" add-on from the catch-all
--      `cross` pillar to `admin` — storage management is an administrative
--      concern in our information architecture.
--   2. Seed two HR add-ons so the HR tab in the Marketplace has content:
--      • payroll-bank-export   — Maybank/CIMB/Public Bank salary CSVs.
--      • holiday-calendar-sync — auto-imports MY public holidays + state.
--
-- The `cross` pillar value is left in the check constraint (no down-migration
-- needed) but no add-on uses it after this migration, and the UI filter for
-- "Cross-cutting" is removed in the same change set.
-- ============================================================================

update public.marketplace_addons
   set pillar     = 'admin',
       sort_order = 22
 where slug = 'storage-10gb';

insert into public.marketplace_addons
  (slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence,
   included_in_tier, is_featured, sort_order)
values
  ('payroll-bank-export',
   'Payroll bank export',
   'One-click salary CSVs for Maybank, CIMB, Public Bank, and RHB direct-credit batches.',
   'Generates the bank-specific text/CSV format each Malaysian bank expects for bulk payroll uploads. Stores submission receipts in the audit log and auto-fills EPF, SOCSO, and EIS contributions per employee.',
   'hr', 'shopping-bag', 2000, 'monthly', '{}', false, 90),

  ('holiday-calendar-sync',
   'Public holiday calendar sync',
   'Auto-imports Malaysia federal + selected-state public holidays into the HR leave calendar.',
   'Picks up Cuti Umum and state holidays (Selangor, KL, Pulau Pinang, Sabah, Sarawak, etc.). Blocks leave requests on closed days and syncs to staff phone calendars.',
   'hr', 'file-check', 0, 'included', '{"sme","enterprise"}', false, 95)
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
