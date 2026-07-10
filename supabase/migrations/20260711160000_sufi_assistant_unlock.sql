-- Unlock Sales AI (Sufi) for purchase — chat + lead tools now shipped.
-- Price remains RM 20/mo (price_cents = 2000) with 100 shared credits on activate.

update public.marketplace_addons
   set is_coming_soon = false,
       name = 'Sales AI (Sufi)',
       short_desc = 'Chat with Sufi about leads, follow-ups, and today''s POS.',
       long_desc = 'Sufi plans like sales staff: free clarifying questions, then credit-metered plans and actions. Create or update leads, add notes, set follow-ups, convert to Marketing customers, and draft chase messages. 100 AI credits/month included in the shared pool. RM 20/mo.'
 where slug = 'sales-assistant';
