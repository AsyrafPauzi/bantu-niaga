-- Track per-browser sessions for Settings → Security → Active sessions.
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  user_agent text,
  ip_address text,
  location_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists user_sessions_user_recent_idx
  on public.user_sessions (user_id, last_seen_at desc);

create index if not exists user_sessions_user_active_idx
  on public.user_sessions (user_id)
  where revoked_at is null;

alter table public.user_sessions enable row level security;

create policy "user_sessions_select_own" on public.user_sessions
  for select using (user_id = auth.uid());

create policy "user_sessions_insert_own" on public.user_sessions
  for insert with check (user_id = auth.uid());

create policy "user_sessions_update_own" on public.user_sessions
  for update using (user_id = auth.uid());
