-- Nadia: platform revenue analyst + agent settings jsonb column.

alter table public.ai_agents
  add column if not exists settings jsonb not null default '{}'::jsonb;

insert into public.ai_agents (slug, name, short_desc, pillar, icon, default_model, status, settings)
values (
  'nadia',
  'Nadia',
  'Platform revenue & ops analyst (read-only)',
  'platform',
  'line-chart',
  'ilmu-v3.1',
  'active',
  '{"reply_mode":"text_and_voice","voice_auto_play":true}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  pillar = excluded.pillar,
  icon = excluded.icon,
  default_model = excluded.default_model,
  settings = excluded.settings,
  updated_at = now();

do $$
declare
  v_agent_id uuid;
  v_version_id uuid;
begin
  select id into v_agent_id from public.ai_agents where slug = 'nadia';
  if v_agent_id is null then
    return;
  end if;

  if exists (select 1 from public.ai_agent_versions where agent_id = v_agent_id) then
    return;
  end if;

  insert into public.ai_agent_versions
    (agent_id, version_label, system_prompt, allowed_actions, guardrails,
     escalation, knowledge_base, default_tone, published_at)
  values (
    v_agent_id,
    'v1.0.0',
    'You are Nadia, the Bantu Niaga platform revenue and operations analyst for super administrators. '
    'You answer questions using ONLY the platform snapshot JSON provided in the conversation. '
    'Never invent numbers, tenant names, or invoice amounts. '
    'If data is missing, say you do not have it. '
    'You are read-only: never suggest impersonation, billing changes, or tenant mutations. '
    'Respond in the language the admin uses (Bahasa Melayu or English). '
    'Keep answers concise and cite RM amounts with two decimal places.',
    jsonb_build_array(
      jsonb_build_object('key', 'read_platform_snapshot', 'label', 'Read platform snapshot', 'note', 'Revenue, tenants, health KPIs', 'on', true),
      jsonb_build_object('key', 'execute_mutation', 'label', 'Execute any mutation', 'note', 'Blocked — display only', 'on', false)
    ),
    jsonb_build_array(
      jsonb_build_object('label', 'Invent financial figures', 'detail', 'Use snapshot only', 'severity', 'always'),
      jsonb_build_object('label', 'Modify tenant or billing data', 'detail', 'Read-only analyst', 'severity', 'always')
    ),
    jsonb_build_array(
      jsonb_build_object('trigger', 'Question outside snapshot', 'target', 'Say data is not in the current snapshot')
    ),
    jsonb_build_array(
      jsonb_build_object('label', 'Platform revenue snapshot (live)', 'kind', 'Live source', 'size', 'live')
    ),
    'Professional + precise',
    now()
  )
  returning id into v_version_id;

  update public.ai_agents
  set published_version_id = v_version_id, updated_at = now()
  where id = v_agent_id;
end$$;
