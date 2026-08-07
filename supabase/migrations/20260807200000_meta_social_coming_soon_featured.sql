-- Meta Social is catalog-only until full FB/IG publish flow is shipped (CHECKLIST §6.2).

update public.marketplace_addons
   set is_coming_soon = true,
       is_featured = false
 where slug = 'meta-social';

-- Feature a shipped add-on instead.
update public.marketplace_addons
   set is_featured = true
 where slug = 'storage-10gb';
