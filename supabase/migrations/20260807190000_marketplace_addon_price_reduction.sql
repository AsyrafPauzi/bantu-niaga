-- Stackable add-on prices (pricing-plan §9) — ~50% below legacy catalog placeholders.
-- Keeps each recurring SKU under typical plan MRR ceilings so tenants can stack several.

update public.marketplace_addons
   set price_cents = case slug
     when 'extra-seat' then 900
     when 'whatsapp-business' then 1600
     when 'whatsapp-business-api' then 1600
     when 'boardroom-weekly' then 1100
     when 'shopee-sync' then 1400
     when 'sales-shopee-sync' then 1400
     when 'tiktok-sync' then 1400
     when 'sales-tiktok-sync' then 1400
     when 'finance-sst-reporting' then 900
     when 'finance-cashflow-forecast' then 900
     when 'finance-ledger-analytics' then 1400
     when 'finance-payment-gateway' then 1400
     when 'finance-payment-reminders' then 900
     when 'sales-storefront' then 1400
     when 'sales-hardware-pos' then 1400
     when 'sales-by-staff' then 900
     when 'sales-coupon-tracking' then 900
     when 'sales-daily-closeout' then 1400
     when 'sales-duitnow-dynamic' then 900
     when 'sales-refund-void' then 900
     when 'sales-offline-pos' then 1400
     when 'sales-stale-leads' then 700
     when 'marketing-audience-export' then 1400
     when 'meta-social' then 1100
     when 'email-campaign-automation' then 1100
     when 'dormant-reactivation' then 900
     when 'campaign-analytics' then 900
     when 'loyalty-reviews' then 900
     when 'clv-report' then 900
     when 'admin-compliance-alerts' then 700
     when 'admin-smart-vault' then 700
     when 'admin-doc-builder' then 1400
     when 'admin-approval-workflow' then 900
     when 'product-variants' then 900
     when 'operations-multi-location-stock' then 1400
     when 'customer-booking-page' then 900
     when 'operations-resource-scheduling' then 900
     when 'operations-supplier-analytics' then 900
     when 'auto-stock-deduction' then 900
     when 'operations-purchase-orders' then 900
     when 'operations-auto-reorder' then 900
     when 'hr-shift-roster' then 1400
     when 'hr-time-clock' then 1400
     when 'hr-payroll-pack' then 1600
     when 'hr-reminder-pack' then 900
     when 'hr-advanced-leave-policy' then 900
     when 'hr-contract-letters' then 900
     when 'payroll-bank-export' then 1400
     else price_cents
   end
 where cadence = 'monthly';

-- Safety cap: no monthly add-on above RM19 except statutory/shift bundles already priced.
update public.marketplace_addons
   set price_cents = 1900
 where cadence = 'monthly'
   and price_cents > 1900
   and slug not in ('hr-shift-attendance', 'hr-payroll-statutory', 'hr-payroll-pack');
