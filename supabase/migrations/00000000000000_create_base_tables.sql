-- ============================================================================
-- Bantu Niaga — initial schema skeleton
-- ============================================================================
-- Phase 0 foundation:
--   1. Enable required extensions
--   2. businesses table (the multi-tenant root)
--   3. users table (linked to auth.users; stores role + business_id)
--   4. audit_log (every mutation; required for LHDN audit)
--   5. events_outbox (transactional outbox for cross-pillar sync)
--
-- Per-pillar tables (customers, invoices, products, employees, etc.) land in
-- their own migration files when each pillar's Phase work begins.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- businesses
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  idcompany text unique not null,           -- public slug (used in URLs)
  name text not null,
  state_code text,                          -- KUL, SGR, JHR, ... for public-holiday calendar
  duitnow_id text,                          -- merchant's DuitNow ID for Pay Now panel
  sst_enabled boolean not null default false,
  sst_rate_pct numeric(5, 2) not null default 0,
  invoice_number_prefix text not null default 'INV',
  invoice_number_year_reset boolean not null default true,
  tier text not null default 'starter' check (tier in ('starter', 'micro', 'sme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is 'Multi-tenant root. Every other table references business_id.';

create index if not exists businesses_idcompany_idx on public.businesses (idcompany);

-- ─────────────────────────────────────────────────────────────────────────
-- users (application-side user records, linked to auth.users)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null check (role in (
    'owner', 'manager', 'accountant', 'hr_officer', 'cashier', 'staff'
  )),
  display_name text,
  phone_e164 text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_business_id_idx on public.users (business_id);

-- ─────────────────────────────────────────────────────────────────────────
-- audit_log
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_user_id uuid references public.users (id) on delete set null,
  action text not null,                     -- e.g. 'invoice.create', 'employee.update'
  entity_type text not null,
  entity_id uuid,
  diff jsonb,                               -- before/after snapshot
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_business_id_idx on public.audit_log (business_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────
-- events_outbox (transactional outbox for cross-pillar sync)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.events_outbox (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,                       -- e.g. 'invoice.paid', 'lead.captured'
  payload jsonb not null,
  emitted_by_user_id uuid references public.users (id) on delete set null,
  emitted_at timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create index if not exists events_outbox_undispatched_idx
  on public.events_outbox (emitted_at)
  where dispatched_at is null;
create index if not exists events_outbox_business_idx on public.events_outbox (business_id, emitted_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — enable on all tenant-scoped tables
-- ─────────────────────────────────────────────────────────────────────────
alter table public.businesses enable row level security;
alter table public.users enable row level security;
alter table public.audit_log enable row level security;
alter table public.events_outbox enable row level security;

-- Helper: resolve the current user's business_id from JWT claim or users row.
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.users where id = auth.uid()
$$;

grant execute on function public.current_business_id() to authenticated;

-- Baseline isolation policies (full lockdown until per-feature policies layer in).
create policy "users_self_business" on public.users
  for select using (business_id = public.current_business_id());

create policy "audit_log_self_business" on public.audit_log
  for select using (business_id = public.current_business_id());

create policy "events_outbox_self_business" on public.events_outbox
  for select using (business_id = public.current_business_id());

create policy "businesses_self" on public.businesses
  for select using (id = public.current_business_id());

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
