-- Unlock Marketing AI (Maya) for purchase — chat + tools now shipped.
-- Price remains RM 20/mo (price_cents = 2000) with 100 shared credits on activate.

update public.marketplace_addons
   set is_coming_soon = false,
       name = 'Marketing AI (Maya)',
       short_desc = 'Chat with Maya about customers, drafts, and promos.',
       long_desc = 'Maya answers from your Marketing CRM, drafts WhatsApp/email broadcasts, creates coupons and content calendar posts, and can add customer notes or tags. 100 AI credits/month included in the shared pool. RM 20/mo.'
 where slug = 'marketing-assistant';
