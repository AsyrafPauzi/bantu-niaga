-- Drop Auto reasoning mode; map models: fast → ilmu-mini-v3.3, deep → ilmu-v3.1.

update public.business_agent_settings
  set reasoning_mode = 'fast'
  where reasoning_mode = 'auto';

alter table public.business_agent_settings
  drop constraint if exists business_agent_settings_reasoning_mode_check;

alter table public.business_agent_settings
  add constraint business_agent_settings_reasoning_mode_check
  check (reasoning_mode in ('fast', 'deep'));
