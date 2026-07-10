-- Boardroom meeting room: sessions, transcript, pause/end.

create table if not exists public.boardroom_meetings (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  created_by          uuid not null references auth.users (id) on delete restrict,
  status              text not null default 'active'
                      check (status in ('active', 'paused', 'ended')),
  invited_agent_ids   text[] not null default '{}',
  title               text,
  awaiting_clarifiers boolean not null default false,
  pending_decisions   jsonb,
  pending_actions     jsonb,
  credits_spent       integer not null default 0 check (credits_spent >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  paused_at           timestamptz,
  ended_at            timestamptz
);

comment on table public.boardroom_meetings is
  'AI Boardroom meeting sessions — pick attendees, pause/resume/end, history.';

create index if not exists boardroom_meetings_business_status_idx
  on public.boardroom_meetings (business_id, status, updated_at desc);

-- At most one paused meeting per business (enforced in app; partial unique helps).
create unique index if not exists boardroom_meetings_one_paused_per_business
  on public.boardroom_meetings (business_id)
  where status = 'paused';

create unique index if not exists boardroom_meetings_one_active_per_business
  on public.boardroom_meetings (business_id)
  where status = 'active';

drop trigger if exists boardroom_meetings_set_updated_at on public.boardroom_meetings;
create trigger boardroom_meetings_set_updated_at
  before update on public.boardroom_meetings
  for each row execute function public.set_updated_at();

create table if not exists public.boardroom_messages (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  meeting_id   uuid not null references public.boardroom_meetings (id) on delete cascade,
  role         text not null
               check (role in ('user', 'agent', 'room_clarifier', 'synth', 'system')),
  agent_id     text,
  content      text not null,
  meta         jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.boardroom_messages is
  'Transcript lines for boardroom_meetings.';

create index if not exists boardroom_messages_meeting_idx
  on public.boardroom_messages (meeting_id, created_at);

alter table public.boardroom_meetings enable row level security;
alter table public.boardroom_messages enable row level security;

drop policy if exists "boardroom_meetings_select" on public.boardroom_meetings;
create policy "boardroom_meetings_select" on public.boardroom_meetings
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "boardroom_meetings_insert" on public.boardroom_meetings;
create policy "boardroom_meetings_insert" on public.boardroom_meetings
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "boardroom_meetings_update" on public.boardroom_meetings;
create policy "boardroom_meetings_update" on public.boardroom_meetings
  for update using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "boardroom_messages_select" on public.boardroom_messages;
create policy "boardroom_messages_select" on public.boardroom_messages
  for select using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "boardroom_messages_insert" on public.boardroom_messages;
create policy "boardroom_messages_insert" on public.boardroom_messages
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );
