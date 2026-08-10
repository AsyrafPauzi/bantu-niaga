-- HR core payroll (hide payroll addons) + activate shift attendance & reminder pack.

update public.marketplace_addons
   set status = 'disabled',
       is_coming_soon = true
 where slug in ('hr-payroll-pack', 'hr-payroll-statutory');

update public.marketplace_addons
   set is_coming_soon = false,
       status = 'live'
 where slug in ('hr-shift-attendance', 'hr-reminder-pack');
