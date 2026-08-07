-- Align marketplace catalog with shipped vs placeholder add-ons (CHECKLIST §5–10).
-- Shopee/TikTok/WhatsApp channel sync and LHDN are not built — must not show Activate.

update public.marketplace_addons
   set is_coming_soon = true
 where slug not in (
   'admin-assistant',
   'finance-assistant',
   'marketing-assistant',
   'sales-assistant',
   'operations-assistant',
   'hr-assistant',
   'hr-public-holidays',
   'hr-staff-appraisal',
   'hr-staff-portal',
   'storage-10gb',
   'boardroom-weekly',
   'boost-credits-100',
   'boost-credits-300',
   'boost-credits-500'
 );

-- Legacy / duplicate catalog rows
update public.marketplace_addons
   set is_coming_soon = true
 where slug in (
   'holiday-calendar-sync',
   'shopee-sync',
   'sales-shopee-sync',
   'sales-tiktok-sync',
   'tiktok-sync',
   'whatsapp-business',
   'whatsapp-business-api',
   'lhdn-einvoice',
   'extra-seat'
 );
