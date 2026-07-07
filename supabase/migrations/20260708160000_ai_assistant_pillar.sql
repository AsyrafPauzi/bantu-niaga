-- Module AI assistants live under the Marketplace "AI agents" tab (not their module pillar).

update public.marketplace_addons
   set pillar = 'ai'
 where slug in (
   'hr-assistant',
   'marketing-assistant',
   'finance-assistant',
   'operations-assistant',
   'sales-assistant',
   'admin-assistant'
 );
