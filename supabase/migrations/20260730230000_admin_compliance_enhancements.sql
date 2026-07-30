-- Compliance tracker: document link, renewal history, in-app reminder alerts, categories.

alter table public.admin_compliance_items
  add column if not exists admin_file_id uuid references public.admin_files(id) on delete set null;

create index if not exists admin_compliance_admin_file_idx
  on public.admin_compliance_items (admin_file_id)
  where admin_file_id is not null and deleted_at is null;

alter table public.admin_compliance_items
  drop constraint if exists admin_compliance_items_category_check;

alter table public.admin_compliance_items
  add constraint admin_compliance_items_category_check
  check (category in (
    'ssm', 'dbkl', 'halal', 'food_handler', 'insurance',
    'tenancy', 'tax', 'bomba', 'local_council', 'other'
  ));

create table if not exists public.admin_compliance_renewal_events (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  compliance_item_id  uuid not null references public.admin_compliance_items(id) on delete cascade,
  previous_expires_on date not null,
  new_expires_on      date not null,
  renewed_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists admin_compliance_renewal_item_idx
  on public.admin_compliance_renewal_events (compliance_item_id, created_at desc);

alter table public.admin_compliance_renewal_events enable row level security;

drop policy if exists "admin_compliance_renewal_select" on public.admin_compliance_renewal_events;
create policy "admin_compliance_renewal_select" on public.admin_compliance_renewal_events
  for select using (business_id = public.current_business_id());

drop policy if exists "admin_compliance_renewal_insert" on public.admin_compliance_renewal_events;
create policy "admin_compliance_renewal_insert" on public.admin_compliance_renewal_events
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

create table if not exists public.compliance_in_app_alerts (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  compliance_item_id  uuid not null references public.admin_compliance_items(id) on delete cascade,
  notice_date         date not null default (timezone('Asia/Kuala_Lumpur', now()))::date,
  days_before         integer not null default -1,
  message             text not null check (char_length(trim(message)) > 0),
  dismissed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create unique index if not exists compliance_in_app_alerts_dedup_idx
  on public.compliance_in_app_alerts (compliance_item_id, notice_date, days_before)
  where dismissed_at is null;

create index if not exists compliance_in_app_alerts_business_active_idx
  on public.compliance_in_app_alerts (business_id, notice_date desc)
  where dismissed_at is null;

alter table public.compliance_in_app_alerts enable row level security;

drop policy if exists "compliance_in_app_alerts_select" on public.compliance_in_app_alerts;
create policy "compliance_in_app_alerts_select" on public.compliance_in_app_alerts
  for select using (business_id = public.current_business_id());

drop policy if exists "compliance_in_app_alerts_update" on public.compliance_in_app_alerts;
create policy "compliance_in_app_alerts_update" on public.compliance_in_app_alerts
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (business_id = public.current_business_id());
