-- Marketing add-ons: mark as coming soon + seed Premium packs.
-- Core Marketing (CRM, segments, content calendar, coupons, share broadcasts)
-- stays in the Pro plan. Channel APIs, AI, and automation are Marketplace add-ons.

-- Existing marketing-pillar catalog rows → coming soon
update public.marketplace_addons
   set is_coming_soon = true
 where pillar = 'marketing'
    or slug in (
      'whatsapp-business',
      'tiktok-sync',
      'marketing-assistant'
    );

insert into public.marketplace_addons (
  slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence,
  sort_order, is_featured, is_coming_soon
)
values
  (
    'meta-social',
    'Meta Social (Facebook + Instagram)',
    'Connect pages, publish posts, and pull engagement insights.',
    'Official Meta Graph API connect for Facebook Pages and Instagram Business. Publish from the content calendar and sync views, likes, and comments. Coming soon.',
    'marketing',
    'facebook',
    2900,
    'monthly',
    8,
    true,
    true
  ),
  (
    'email-campaign-automation',
    'Email campaign automation',
    'Scheduled drips and win-back sequences for your CRM segments.',
    'Automate welcome, dormant, and VIP email sequences with Resend. Coming soon.',
    'marketing',
    'mail',
    2900,
    'monthly',
    15,
    false,
    true
  ),
  (
    'dormant-reactivation',
    'Dormant customer reactivation',
    'Auto win-back packs for customers who have not purchased recently.',
    'Scheduled WhatsApp/email nudges for dormant and at-risk segments. Coming soon — core already includes dormant filters and manual broadcasts.',
    'marketing',
    'refresh-cw',
    2500,
    'monthly',
    16,
    false,
    true
  ),
  (
    'campaign-analytics',
    'Campaign performance analytics',
    'Deeper broadcast and coupon ROI reports.',
    'Channel attribution, coupon lift, and segment conversion dashboards. Coming soon.',
    'marketing',
    'bar-chart-3',
    2500,
    'monthly',
    17,
    false,
    true
  ),
  (
    'loyalty-reviews',
    'Loyalty & review tools',
    'Points, stamps, and review request links after purchase.',
    'Simple loyalty cards and post-purchase review asks. Coming soon.',
    'marketing',
    'heart',
    3500,
    'monthly',
    18,
    false,
    true
  ),
  (
    'clv-report',
    'Customer lifetime value report',
    'CLV cohorts and high-value customer lists.',
    'Lifetime value snapshots and export for VIP targeting. Coming soon.',
    'marketing',
    'trending-up',
    2000,
    'monthly',
    19,
    false,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  long_desc = excluded.long_desc,
  pillar = excluded.pillar,
  price_cents = excluded.price_cents,
  is_coming_soon = true,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;
