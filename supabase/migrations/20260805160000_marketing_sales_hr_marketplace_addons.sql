-- Marketing, Sales, HR marketplace add-ons: catalog placeholders + shipped AI/status fixes.
-- Cross-pillar add-ons (extra-seat) remain under admin/finance migrations.

-- ── Shipped assistants (not coming soon) ─────────────────────────────────────
update public.marketplace_addons
   set is_coming_soon = false
 where slug in (
   'marketing-assistant',
   'sales-assistant',
   'hr-assistant'
 );

-- ── Shipped HR add-ons ───────────────────────────────────────────────────────
update public.marketplace_addons
   set is_coming_soon = false
 where slug in (
   'hr-public-holidays',
   'hr-staff-appraisal',
   'hr-staff-portal'
 );

-- ── Marketing channel/automation placeholders (coming soon) ──────────────────
update public.marketplace_addons
   set is_coming_soon = true
 where slug in ('whatsapp-business', 'tiktok-sync')
    or pillar = 'marketing' and slug not in ('marketing-assistant');

-- ── Sales add-ons (coming soon) ──────────────────────────────────────────────
insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence,
  sort_order, is_featured, is_coming_soon
)
values
  (
    'sales-storefront',
    'Online storefront',
    'Public product page with checkout link.',
    'Share a simple shop page for customers to browse and order online. Coming soon.',
    'sales', 'store', 3900, 'monthly', 40, true, true
  ),
  (
    'sales-hardware-pos',
    'Hardware POS extensions',
    'Barcode scanner and receipt printer support.',
    'Connect USB or Bluetooth scanners and thermal printers for faster counter checkout. Coming soon.',
    'sales', 'printer', 2900, 'monthly', 41, false, true
  ),
  (
    'sales-by-staff',
    'Sales by staff report',
    'Cashier performance and commission-ready totals.',
    'See revenue and transaction counts per team member over any period. Coming soon.',
    'sales', 'users', 2500, 'monthly', 42, false, true
  ),
  (
    'sales-coupon-tracking',
    'Coupon-to-sales tracking',
    'Promo ROI with Marketing coupon redemptions.',
    'Attribute POS revenue to coupon codes and campaigns. Coming soon.',
    'sales', 'percent', 2500, 'monthly', 43, false, true
  ),
  (
    'sales-daily-closeout',
    'Daily close-out reconciliation',
    'End-of-day cash count vs POS totals.',
    'Manager sign-off when physical cash matches the till. Coming soon.',
    'sales', 'calculator', 2900, 'monthly', 44, true, true
  ),
  (
    'sales-duitnow-dynamic',
    'Dynamic DuitNow QR',
    'Amount-specific QR on every sale.',
    'Generate a unique DuitNow QR per transaction instead of a static merchant QR. Coming soon.',
    'sales', 'qr-code', 2500, 'monthly', 45, true, true
  ),
  (
    'sales-refund-void',
    'Refund & void approval',
    'Manager PIN or approval for voids and refunds.',
    'Extra control layer before high-value voids hit the ledger. Coming soon.',
    'sales', 'shield-check', 2500, 'monthly', 46, false, true
  ),
  (
    'sales-offline-pos',
    'Offline POS mode',
    'Queue sales when internet drops, sync when back online.',
    'Keep selling at markets and pop-ups without connectivity. Coming soon.',
    'sales', 'wifi-off', 3900, 'monthly', 47, true, true
  ),
  (
    'sales-stale-leads',
    'Stale lead alerts',
    'Auto nudge when follow-ups go overdue.',
    'Scheduled reminders for leads with no contact past your SLA. Coming soon.',
    'sales', 'bell-ring', 1900, 'monthly', 48, false, true
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

-- ── Marketing SCALE add-on placeholder ───────────────────────────────────────
insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence,
  sort_order, is_featured, is_coming_soon
)
values
  (
    'marketing-audience-export',
    'Audience export packs',
    'Large segment exports for ads and agencies.',
    'Export CRM segments for Meta Custom Audiences and agency handoffs. Coming soon.',
    'marketing', 'upload', 2900, 'monthly', 7, false, true
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

-- Refresh marketing placeholder copy
update public.marketplace_addons
   set is_coming_soon = true,
       long_desc = coalesce(long_desc, '') || case when long_desc ilike '%coming soon%' then '' else ' Coming soon.' end
 where slug in (
   'meta-social',
   'email-campaign-automation',
   'dormant-reactivation',
   'campaign-analytics',
   'loyalty-reviews',
   'clv-report',
   'whatsapp-business',
   'tiktok-sync'
 );

-- HR coming-soon placeholders stay coming soon
update public.marketplace_addons
   set is_coming_soon = true
 where slug in (
   'hr-advanced-leave-policy',
   'hr-contract-letters',
   'hr-shift-roster',
   'hr-time-clock',
   'hr-payroll-pack',
   'hr-reminder-pack'
 );
