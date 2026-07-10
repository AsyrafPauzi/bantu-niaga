-- Sales Phase B: leads pipeline + notes timeline.

create table if not exists public.sales_leads (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses (id) on delete cascade,
  name                   text not null,
  phone_e164             text not null,
  channel                text check (
    channel is null or channel in (
      'whatsapp', 'instagram', 'referral', 'walk_in', 'call', 'other'
    )
  ),
  interest               text,
  estimated_value_myr    numeric(12, 2) check (
    estimated_value_myr is null or estimated_value_myr >= 0
  ),
  status                 text not null default 'new'
                         check (status in (
                           'new', 'contacted', 'interested', 'won', 'lost'
                         )),
  follow_up_at           timestamptz,
  assigned_to            uuid references auth.users (id) on delete set null,
  customer_id            uuid references public.customers (id) on delete set null,
  converted_at           timestamptz,
  lost_reason            text,
  created_by             uuid not null references auth.users (id) on delete restrict,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.sales_leads is
  'Sales lead pipeline — convert links/creates Marketing customers.';

create index if not exists sales_leads_business_status_idx
  on public.sales_leads (business_id, status, updated_at desc);

create index if not exists sales_leads_business_follow_up_idx
  on public.sales_leads (business_id, follow_up_at)
  where follow_up_at is not null;

create index if not exists sales_leads_business_assigned_idx
  on public.sales_leads (business_id, assigned_to);

create index if not exists sales_leads_business_phone_idx
  on public.sales_leads (business_id, phone_e164);

drop trigger if exists sales_leads_set_updated_at on public.sales_leads;
create trigger sales_leads_set_updated_at
  before update on public.sales_leads
  for each row execute function public.set_updated_at();

create table if not exists public.sales_lead_notes (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  lead_id      uuid not null references public.sales_leads (id) on delete cascade,
  body         text not null,
  created_by   uuid not null references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now()
);

comment on table public.sales_lead_notes is
  'Append-only notes timeline for sales_leads.';

create index if not exists sales_lead_notes_lead_idx
  on public.sales_lead_notes (lead_id, created_at desc);

-- RLS
alter table public.sales_leads enable row level security;
alter table public.sales_lead_notes enable row level security;

drop policy if exists "sales_leads_select" on public.sales_leads;
create policy "sales_leads_select" on public.sales_leads
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  );

drop policy if exists "sales_leads_insert" on public.sales_leads;
create policy "sales_leads_insert" on public.sales_leads
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  );

drop policy if exists "sales_leads_update" on public.sales_leads;
create policy "sales_leads_update" on public.sales_leads
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  );

drop policy if exists "sales_lead_notes_select" on public.sales_lead_notes;
create policy "sales_lead_notes_select" on public.sales_lead_notes
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  );

drop policy if exists "sales_lead_notes_insert" on public.sales_lead_notes;
create policy "sales_lead_notes_insert" on public.sales_lead_notes
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'sales_rep')
  );
