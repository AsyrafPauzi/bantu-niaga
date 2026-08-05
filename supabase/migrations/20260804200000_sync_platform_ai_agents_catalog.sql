-- Align platform ai_agents catalog with tenant runtime slugs (marketing, finance, …).
-- Retire legacy seed slugs (maya, ops, fin, concierge) from the active list.

insert into public.ai_agents (slug, name, short_desc, pillar, icon, default_model, status)
values
  ('marketing',  'Maya',      'Marketing AI',                    'marketing',  'sparkles',      'ilmu-mini-v3.3', 'active'),
  ('finance',    'Fayza',     'Finance AI',                      'finance',    'wallet',        'ilmu-mini-v3.3', 'active'),
  ('operations', 'Aiman',     'Operations AI',                   'operations', 'package',       'ilmu-mini-v3.3', 'active'),
  ('sales',      'Sufi',      'Sales AI',                        'sales',      'sparkles',      'ilmu-mini-v3.3', 'active'),
  ('hr',         'Hana',      'HR AI',                           'hr',         'users',         'ilmu-mini-v3.3', 'active'),
  ('admin',      'Amir',      'Admin AI',                        'admin',      'help-circle',   'ilmu-mini-v3.3', 'active'),
  ('boardroom',  'Boardroom', 'Cross-module executive briefing',   'cross',      'brain-circuit', 'nemo-super',     'active')
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  pillar = excluded.pillar,
  icon = excluded.icon,
  default_model = excluded.default_model,
  status = excluded.status,
  updated_at = now();

update public.ai_agents
set status = 'disabled', updated_at = now()
where slug in ('maya', 'ops', 'fin', 'concierge');

-- Seed a v1 scope draft for new slugs when none exists yet.
do $$
declare
  rec record;
  v_version_id uuid;
begin
  for rec in
    select a.*
    from public.ai_agents a
    where a.status = 'active'
      and a.slug in ('marketing', 'finance', 'operations', 'sales', 'hr', 'admin', 'boardroom')
      and not exists (
        select 1 from public.ai_agent_versions v where v.agent_id = a.id
      )
  loop
    insert into public.ai_agent_versions
      (agent_id, version_label, system_prompt, allowed_actions, guardrails,
       escalation, knowledge_base, default_tone, published_at)
    values (
      rec.id,
      'v1.0.0',
      'You are ' || rec.name || ', a domain copilot inside Bantu Niaga (a Malaysian SME platform). '
      'Respond in the language the owner uses (default Bahasa Melayu). '
      'When unsure, ask the owner before acting. Always cite the data source for any numeric claim.',
      jsonb_build_array(
        jsonb_build_object('key', 'read_module_data', 'label', 'Read pillar data', 'note', 'Pulls from the owner''s own tenant only', 'on', true),
        jsonb_build_object('key', 'draft_artifact', 'label', 'Draft documents / posts / messages', 'note', 'Always presented as draft, never auto-sent', 'on', true),
        jsonb_build_object('key', 'execute_mutation', 'label', 'Execute mutations on behalf of owner', 'note', 'Requires owner confirmation', 'on', false)
      ),
      jsonb_build_array(
        jsonb_build_object('label','Send payments or move funds', 'detail','Blocked at tool layer', 'severity','always'),
        jsonb_build_object('label','Share customer PII with third parties', 'detail','Blocked unless tenant opts in via Marketplace addon', 'severity','always')
      ),
      jsonb_build_array(
        jsonb_build_object('trigger','Confidence < 70%', 'target','ask owner for confirmation')
      ),
      jsonb_build_array(
        jsonb_build_object('label','Tenant catalog (auto-sync)', 'kind','Live source', 'size','live')
      ),
      'Friendly + clear',
      now()
    )
    returning id into v_version_id;

    update public.ai_agents
    set published_version_id = v_version_id, updated_at = now()
    where id = rec.id;
  end loop;
end$$;
