-- Tenant API keys and outgoing webhooks (Settings → Integrations).

create table if not exists public.business_api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  key_prefix text not null,
  key_hash text not null,
  scope text not null check (scope in ('read', 'read+write', 'admin')),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists business_api_keys_hash_idx
  on public.business_api_keys (key_hash)
  where revoked_at is null;

create index if not exists business_api_keys_business_idx
  on public.business_api_keys (business_id, created_at desc);

alter table public.business_api_keys enable row level security;

create policy "business_api_keys_select_own" on public.business_api_keys
  for select using (business_id = public.current_business_id());

create policy "business_api_keys_owner_insert" on public.business_api_keys
  for insert with check (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "business_api_keys_owner_update" on public.business_api_keys
  for update using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create table if not exists public.business_webhooks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null,
  secret_sealed jsonb not null,
  events text[] not null default '{}',
  active boolean not null default true,
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  last_delivered_at timestamptz,
  last_error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_webhooks_business_idx
  on public.business_webhooks (business_id, created_at desc);

create trigger business_webhooks_set_updated_at
  before update on public.business_webhooks
  for each row execute function public.set_updated_at();

alter table public.business_webhooks enable row level security;

create policy "business_webhooks_select_own" on public.business_webhooks
  for select using (business_id = public.current_business_id());

create policy "business_webhooks_owner_insert" on public.business_webhooks
  for insert with check (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "business_webhooks_owner_update" on public.business_webhooks
  for update using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "business_webhooks_owner_delete" on public.business_webhooks
  for delete using (
    business_id = public.current_business_id()
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'owner'
    )
  );
