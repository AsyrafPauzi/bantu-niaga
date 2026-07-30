-- Unlock Finance AI (Fayza) and Operations AI (Aiman) for purchase.
-- Price remains RM 20/mo (price_cents = 2000) with 100 shared credits on activate.

update public.marketplace_addons
   set is_coming_soon = false,
       name = 'Finance AI (Fayza)',
       short_desc = 'Chat with Fayza about invoices, cash flow, and month-end.',
       long_desc = 'Fayza plans like finance staff: free clarifying questions, then credit-metered advice from your invoices and ledger. Advise-only v1 — no auto-recording yet. 100 AI credits/month included in the shared pool. RM 20/mo.'
 where slug = 'finance-assistant';

update public.marketplace_addons
   set is_coming_soon = false,
       name = 'Operations AI (Aiman)',
       short_desc = 'Chat with Aiman about products, orders, and bookings.',
       long_desc = 'Aiman plans like operations staff: free clarifying questions, then credit-metered advice from your catalog and schedule. Advise-only v1 — no auto-updates yet. 100 AI credits/month included in the shared pool. RM 20/mo.'
 where slug = 'operations-assistant';
