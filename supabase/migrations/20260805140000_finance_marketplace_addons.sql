-- Finance marketplace add-ons: catalog placeholders (is_coming_soon = true).
-- Fayza (finance-assistant) stays shippable; Billplz and LHDN listed as coming soon until gated launch.

update public.marketplace_addons
   set is_coming_soon = true
 where slug in ('lhdn-einvoice');

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
    'finance-recurring-invoices',
    'Recurring invoices',
    'Retainers, rentals, and monthly billing on autopilot.',
    'Schedule repeat invoices for subscriptions, rent, and service retainers — draft or auto-send each cycle. Coming soon.',
    'finance',
    'calendar-sync',
    2900,
    'monthly',
    30,
    true,
    true
  ),
  (
    'finance-sst-reporting',
    'SST advanced reporting',
    'Service tax summaries and filing-ready breakdowns.',
    'Track taxable vs exempt sales, SST on invoices, and export period summaries for your tax agent. Coming soon.',
    'finance',
    'percent',
    2900,
    'monthly',
    31,
    false,
    true
  ),
  (
    'finance-cashflow-forecast',
    'Cashflow forecast',
    'Projected balance from invoices, expenses, and overdue bills.',
    'See expected cash in and out for the next 30–90 days based on your open invoices and recurring costs. Coming soon.',
    'finance',
    'trending-up',
    2900,
    'monthly',
    32,
    true,
    true
  ),
  (
    'finance-ledger-analytics',
    'Full ledger analytics',
    'Margin by product, customer, and deeper finance dashboards.',
    'Power-user reporting beyond core P&L — profitability by SKU, customer lifetime value, and trend dashboards. Coming soon.',
    'finance',
    'bar-chart-3',
    3900,
    'monthly',
    33,
    false,
    true
  ),
  (
    'finance-payment-gateway',
    'Payment gateway connector',
    'Billplz live checkout on public invoices with auto mark-paid.',
    'Customers pay via FPX or card on your share link; webhook marks the invoice paid and posts to ledger. Coming soon.',
    'finance',
    'credit-card',
    2500,
    'monthly',
    34,
    true,
    true
  ),
  (
    'finance-bank-reconciliation',
    'Auto bank reconciliation',
    'Match bank CSV or feeds to invoices and POS sales.',
    'Import bank statements and auto-match payments to open invoices and counter sales. Coming soon.',
    'finance',
    'landmark',
    3900,
    'monthly',
    35,
    false,
    true
  ),
  (
    'finance-payment-reminders',
    'Scheduled payment reminders',
    'Automated chase beyond manual WhatsApp copy.',
    'Schedule polite payment nudges before and after due dates — email or WhatsApp when channels are connected. Coming soon.',
    'finance',
    'bell-ring',
    1900,
    'monthly',
    36,
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
