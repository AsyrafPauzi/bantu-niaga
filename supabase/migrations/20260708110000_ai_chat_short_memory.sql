-- Lightweight per-tenant short chat memory (4 turns max, no full transcript archive).
-- Scoped by business_id + user_id + agent_slug so company switches never leak context.

create table if not exists public.ai_chat_short_memory (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_slug text not null,
  turns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id, agent_slug),
  constraint ai_chat_short_memory_turns_array check (jsonb_typeof(turns) = 'array')
);

create index if not exists ai_chat_short_memory_updated_idx
  on public.ai_chat_short_memory (business_id, updated_at desc);

alter table public.ai_chat_short_memory enable row level security;

create policy "ai_chat_short_memory_select_own" on public.ai_chat_short_memory
  for select using (
    business_id = public.current_business_id()
    and user_id = auth.uid()
  );

create policy "ai_chat_short_memory_insert_own" on public.ai_chat_short_memory
  for insert with check (
    business_id = public.current_business_id()
    and user_id = auth.uid()
  );

create policy "ai_chat_short_memory_update_own" on public.ai_chat_short_memory
  for update using (
    business_id = public.current_business_id()
    and user_id = auth.uid()
  )
  with check (
    business_id = public.current_business_id()
    and user_id = auth.uid()
  );

create policy "ai_chat_short_memory_delete_own" on public.ai_chat_short_memory
  for delete using (
    business_id = public.current_business_id()
    and user_id = auth.uid()
  );

comment on table public.ai_chat_short_memory is
  'Rolling window of the last few chat turns per user per business per agent. Not a full archive — keeps token and storage cost low.';
