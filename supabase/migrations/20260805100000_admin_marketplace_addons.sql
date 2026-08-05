-- Admin marketplace add-ons: catalog placeholders (is_coming_soon = true).
-- Tenants see these in Settings → Marketplace but cannot activate until shipped.
-- Amir (admin-assistant) stays under pillar = 'ai'.

-- Existing admin rows → coming soon (no purchasable activation yet).
update public.marketplace_addons
   set is_coming_soon = true
 where slug in ('extra-seat', 'storage-10gb');

insert into public.marketplace_addons (
  slug,
  name,
  short_desc,
  long_desc,
  pillar,
  icon,
  price_cents,
  cadence,
  sort_order,
  is_featured,
  is_coming_soon
)
values
  (
    'admin-compliance-alerts',
    'Smart compliance alerts',
    'Proactive reminders for SSM, licences, tenancy, insurance, and permit renewals.',
    'Stronger compliance nudges beyond the core calendar — missing documents, overdue renewals, and upcoming deadlines in one feed. Coming soon.',
    'admin',
    'bell-ring',
    1900,
    'monthly',
    23,
    false,
    true
  ),
  (
    'admin-smart-vault',
    'Smart document vault',
    'Auto-sort uploads into receipts, invoices, HR files, licences, and contracts.',
    'Less manual filing — uploads are categorized so your team finds files faster. Coming soon.',
    'admin',
    'scan-search',
    1900,
    'monthly',
    24,
    false,
    true
  ),
  (
    'admin-doc-builder',
    'Custom document builder',
    'Reusable branded templates, clauses, and letter layouts.',
    'Create employment letters, agreements, and business templates without starting from scratch each time. Coming soon.',
    'admin',
    'file-pen',
    2900,
    'monthly',
    25,
    false,
    true
  ),
  (
    'admin-digital-signature',
    'Digital signature',
    'Recipients sign from a secure link; signed PDFs return to your vault.',
    'Close contract loops without print, scan, or WhatsApp — audit trail included. Coming soon.',
    'admin',
    'pen-line',
    3900,
    'monthly',
    26,
    true,
    true
  ),
  (
    'admin-approval-workflow',
    'Approval workflow',
    'Owner or manager approval for sensitive documents and internal requests.',
    'Route high-risk uploads, expenses, and tasks through a simple approve / reject flow. Coming soon.',
    'admin',
    'git-branch',
    2900,
    'monthly',
    27,
    false,
    true
  )
on conflict (slug) do update set
  name             = excluded.name,
  short_desc       = excluded.short_desc,
  long_desc        = excluded.long_desc,
  pillar           = excluded.pillar,
  icon             = excluded.icon,
  price_cents      = excluded.price_cents,
  cadence          = excluded.cadence,
  sort_order       = excluded.sort_order,
  is_featured      = excluded.is_featured,
  is_coming_soon   = excluded.is_coming_soon;
