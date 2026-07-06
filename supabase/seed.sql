-- ============================================================================
-- Bantu Niaga — local/dev seed
-- ============================================================================
-- Idempotent. Re-running this file leaves the DB in the same state.
--
-- Seeds the demo business row, a local owner account, and a local super-admin
-- account. These auth.users rows are for local development only.
-- ============================================================================

insert into public.businesses (
  id, idcompany, name, state_code, tier,
  sst_enabled, sst_rate_pct,
  invoice_number_prefix, invoice_number_year_reset
)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo',
  'Bantu Niaga Demo SDN BHD',
  'KUL',
  'enterprise',
  false, 0,
  'INV', true
)
on conflict (id) do update set
  idcompany = excluded.idcompany,
  name = excluded.name,
  state_code = excluded.state_code,
  tier = excluded.tier;

-- ─────────────────────────────────────────────────────────────────────────
-- Local demo auth accounts
-- ─────────────────────────────────────────────────────────────────────────
-- Login credentials are documented in the setup notes, not embedded here in
-- plaintext. The encrypted_password values below are bcrypt hashes for local
-- demo accounts only.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data,
  raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999901',
    'authenticated',
    'authenticated',
    'owner@demo.bantuniaga.local',
    '$2a$06$VTtRb5GJkH7ioqwt3JDyJOTOGVzg6rQikkNDGVCNTPySz5Puknn1e',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Owner"}'::jsonb,
    false,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999902',
    'authenticated',
    'authenticated',
    'admin@demo.bantuniaga.local',
    '$2a$06$GuVSjCeWiaXV4.PRfLlfjuN71OkUHKi/BdqpaHML5Rpdt.qv61qMC',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Super Admin"}'::jsonb,
    false,
    '', '', '', ''
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  updated_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change;

-- GoTrue requires auth.identities rows for email/password sign-in.
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values
  (
    '99999999-9999-4999-8999-999999999901',
    '99999999-9999-4999-8999-999999999901',
    '{"sub":"99999999-9999-4999-8999-999999999901","email":"owner@demo.bantuniaga.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now()
  ),
  (
    '99999999-9999-4999-8999-999999999902',
    '99999999-9999-4999-8999-999999999902',
    '{"sub":"99999999-9999-4999-8999-999999999902","email":"admin@demo.bantuniaga.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', now(), now()
  )
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.users (id, business_id, role, display_name, email)
values (
  '99999999-9999-4999-8999-999999999901',
  '11111111-1111-1111-1111-111111111111',
  'owner',
  'Demo Owner',
  'owner@demo.bantuniaga.local'
)
on conflict (id) do update set
  business_id = excluded.business_id,
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email;

insert into public.platform_admins (user_id, email, display_name, notes, revoked_at)
values (
  '99999999-9999-4999-8999-999999999902',
  'admin@demo.bantuniaga.local',
  'Demo Super Admin',
  'Local demo super admin seeded for development.',
  null
)
on conflict (email) do update set
  user_id = excluded.user_id,
  display_name = excluded.display_name,
  notes = excluded.notes,
  revoked_at = null;

-- ─────────────────────────────────────────────────────────────────────────
-- Demo HR data
-- ─────────────────────────────────────────────────────────────────────────
-- Keeps the Growth/Pro HR dashboard useful in local development.

insert into public.hr_employees (
  id, business_id, full_name, employment_type, role_title, start_date, status,
  identity_type, identity_number, phone_e164, email,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
  bank_name, bank_account_no, bank_account_holder, notes
)
values
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'Aisyah Rahman', 'full_time', 'Cafe Supervisor', '2025-03-10', 'active',
    'ic', '900101-14-5678', '+60123456701', 'aisyah@example.test',
    'Rahman Omar', 'Father', '+60123456702',
    'Maybank', '514088001234', 'Aisyah Rahman',
    'Handles daily floor operations and cashier close-out.'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'Daniel Tan', 'full_time', 'Sales Assistant', '2025-08-01', 'active',
    'ic', '930202-10-1122', '+60123456703', 'daniel@example.test',
    'Mei Ling', 'Spouse', '+60123456704',
    'CIMB', '8001234567', 'Daniel Tan',
    'Supports POS and customer enquiries.'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111111',
    'Nurul Izzah', 'part_time', 'Kitchen Crew', '2026-01-15', 'active',
    'ic', '960303-08-7788', '+60123456705', 'nurul@example.test',
    'Siti Mariam', 'Mother', '+60123456706',
    'Bank Islam', '120012345678', 'Nurul Izzah',
    'Part-time kitchen support during peak hours.'
  ),
  (
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111111',
    'Hafiz Ismail', 'contract', 'Delivery Runner', '2026-04-01', 'active',
    'ic', '950404-03-3344', '+60123456707', 'hafiz@example.test',
    'Ismail Salleh', 'Brother', '+60123456708',
    'RHB', '211234567890', 'Hafiz Ismail',
    'Contract delivery support.'
  )
on conflict (id) do update set
  full_name = excluded.full_name,
  employment_type = excluded.employment_type,
  role_title = excluded.role_title,
  start_date = excluded.start_date,
  status = excluded.status,
  identity_type = excluded.identity_type,
  identity_number = excluded.identity_number,
  phone_e164 = excluded.phone_e164,
  email = excluded.email,
  emergency_contact_name = excluded.emergency_contact_name,
  emergency_contact_relationship = excluded.emergency_contact_relationship,
  emergency_contact_phone = excluded.emergency_contact_phone,
  bank_name = excluded.bank_name,
  bank_account_no = excluded.bank_account_no,
  bank_account_holder = excluded.bank_account_holder,
  notes = excluded.notes;

insert into public.hr_leave_records (
  id, business_id, employee_id, leave_type, start_date, end_date, reason,
  status, decision_note, decided_at
)
values
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'annual', current_date + 5, current_date + 7,
    'Family trip planned earlier.', 'pending', null, null
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222203',
    'mc', current_date - 1, current_date - 1,
    'Clinic MC uploaded to HR document folder.', 'approved', 'Approved by owner.', now() - interval '1 day'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222204',
    'emergency', current_date, current_date,
    'Urgent family matter.', 'approved', 'Covered by Daniel.', now()
  )
on conflict (id) do update set
  leave_type = excluded.leave_type,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  reason = excluded.reason,
  status = excluded.status,
  decision_note = excluded.decision_note,
  decided_at = excluded.decided_at;

insert into public.hr_onboarding_items (
  id, business_id, employee_id, label, is_done, completed_at
)
values
  (
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222204',
    'Collect signed contract', false, null
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222204',
    'Brief delivery SOP', false, null
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'Bank details collected', true, now() - interval '10 days'
  )
on conflict (id) do update set
  label = excluded.label,
  is_done = excluded.is_done,
  completed_at = excluded.completed_at;

insert into public.hr_employee_documents (
  id, business_id, employee_id, document_type, label
)
values
  (
    '55555555-5555-5555-5555-555555555501',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'ic',
    'IC copy stored in HR document folder'
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222203',
    'medical',
    'MC record for latest medical leave'
  )
on conflict (id) do update set
  document_type = excluded.document_type,
  label = excluded.label;

insert into public.hr_public_holidays (
  id, business_id, state_code, holiday_date, name
)
values
  (
    '66666666-6666-6666-6666-666666666601',
    '11111111-1111-1111-1111-111111111111',
    'KUL',
    date '2026-08-31',
    'Hari Kebangsaan'
  ),
  (
    '66666666-6666-6666-6666-666666666602',
    '11111111-1111-1111-1111-111111111111',
    'KUL',
    date '2026-09-16',
    'Hari Malaysia'
  )
on conflict (business_id, state_code, holiday_date, name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Demo Marketing data for the same Pro tenant
-- ─────────────────────────────────────────────────────────────────────────
-- Lets the single highest-plan demo account exercise HR + Marketing together.

insert into public.customers (
  id, business_id, name, phone_e164, email, manual_tags, notes,
  total_spend_myr, order_count, source, created_at, last_purchase_at
)
values
  (
    '77777777-7777-7777-7777-777777777701',
    '11111111-1111-1111-1111-111111111111',
    'Aiman Bin Yusof',
    '+60125550101',
    'aiman.demo@example.test',
    array['vip','regular'],
    'Lunch catering customer. Good fit for retention campaign.',
    1840.00,
    7,
    'manual',
    now() - interval '180 days',
    now() - interval '6 days'
  ),
  (
    '77777777-7777-7777-7777-777777777702',
    '11111111-1111-1111-1111-111111111111',
    'Siti Nurhaliza Binti Roslan',
    '+60125550102',
    'siti.demo@example.test',
    array['new','whatsapp'],
    'New customer from WhatsApp enquiry.',
    240.00,
    1,
    'manual',
    now() - interval '21 days',
    now() - interval '18 days'
  ),
  (
    '77777777-7777-7777-7777-777777777703',
    '11111111-1111-1111-1111-111111111111',
    'Tan Wei Ling',
    '+60125550103',
    'weiling.demo@example.test',
    array['dormant','coupon'],
    'Has not returned this month. Use coupon reactivation.',
    690.00,
    4,
    'manual',
    now() - interval '260 days',
    now() - interval '75 days'
  ),
  (
    '77777777-7777-7777-7777-777777777704',
    '11111111-1111-1111-1111-111111111111',
    'Rajesh Kumar',
    '+60125550104',
    'rajesh.demo@example.test',
    array['catering','high-value'],
    'Corporate catering lead for monthly office orders.',
    3250.00,
    5,
    'manual',
    now() - interval '320 days',
    now() - interval '12 days'
  )
on conflict (id) do update set
  name = excluded.name,
  phone_e164 = excluded.phone_e164,
  email = excluded.email,
  manual_tags = excluded.manual_tags,
  notes = excluded.notes,
  total_spend_myr = excluded.total_spend_myr,
  order_count = excluded.order_count,
  source = excluded.source,
  created_at = excluded.created_at,
  last_purchase_at = excluded.last_purchase_at;

insert into public.content_plan (
  id, business_id, channel, status, scheduled_at, posted_at, hook, caption
)
values
  (
    '88888888-8888-8888-8888-888888888801',
    '11111111-1111-1111-1111-111111111111',
    'instagram',
    'scheduled',
    now() + interval '2 days',
    null,
    'Behind the scenes: preparing 80 lunch boxes before 10am',
    'Our kitchen team starts early so your office lunch arrives warm. DM to book July catering slots.'
  ),
  (
    '88888888-8888-8888-8888-888888888802',
    '11111111-1111-1111-1111-111111111111',
    'facebook',
    'posted',
    now() - interval '5 days',
    now() - interval '5 days',
    'Corporate catering bookings open for next month',
    'Order 30+ pax for office lunch. Includes delivery within KL and simple invoice link.'
  ),
  (
    '88888888-8888-8888-8888-888888888803',
    '11111111-1111-1111-1111-111111111111',
    'tiktok',
    'drafted',
    now() + interval '7 days',
    null,
    'How we pack sambal so it does not leak during delivery',
    'A simple packing tip from our team. Save this if you sell food from home.'
  )
on conflict (id) do update set
  channel = excluded.channel,
  status = excluded.status,
  scheduled_at = excluded.scheduled_at,
  posted_at = excluded.posted_at,
  hook = excluded.hook,
  caption = excluded.caption;
