-- ============================================================================
-- 00000000000015_super_admin.sql
--
-- Super-admin (platform-admin) foundation. Introduces:
--
--   1. public.platform_admins              — allow-list of platform staff
--   2. public.is_platform_admin()          — helper for RLS + RPCs
--   3. public.ai_agents + public.ai_agent_versions
--                                          — versioned scope + guardrails JSON
--   4. public.ai_agent_usage_daily         — per-day usage roll-up (per tenant)
--   5. public.super_admin_audit            — cross-tenant audit (separate from
--                                            tenant-scoped public.audit_log)
--   6. RLS additions on businesses/users/marketplace_addons so platform
--      admins can read across tenants
--   7. Seed data: 6 AI agents + a default scope/guardrails version each
--
-- Notes:
--   - We deliberately keep cross-tenant *writes* off the table policies and
--     route them through SECURITY DEFINER RPCs that perform their own
--     is_platform_admin() check. This mirrors the marketplace pattern.
--   - Tenant data (invoices, customers, etc.) stays tenant-scoped at the
--     RLS level. The super-admin app uses the service-role client in
--     `lib/supabase/service-role.ts` for the read paths that need to span
--     tenants (after a server-side is_platform_admin() check).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. platform_admins
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  id          uuid primary key default extensions.uuid_generate_v4(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text unique not null,
  display_name text,
  granted_by  uuid references public.platform_admins(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

comment on table public.platform_admins is
  'Allow-list of Bantu Niaga platform staff. NOT scoped to any business. '
  'Membership grants cross-tenant read + the ability to call super_admin_* RPCs.';

create index if not exists platform_admins_email_idx on public.platform_admins (email);
create index if not exists platform_admins_user_idx  on public.platform_admins (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. is_platform_admin() — helper used by RLS + RPCs.
--    Returns true iff the caller has an unrevoked platform_admins row.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.platform_admins pa
     where pa.user_id = auth.uid()
       and pa.revoked_at is null
  )
$$;

grant execute on function public.is_platform_admin() to authenticated;

alter table public.platform_admins enable row level security;

create policy platform_admins_read_self on public.platform_admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Only existing platform admins can grant new ones (mutations go via RPC).
create policy platform_admins_insert_via_admin on public.platform_admins
  for insert to authenticated
  with check (public.is_platform_admin());

create policy platform_admins_update_via_admin on public.platform_admins
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. ai_agents catalog + ai_agent_versions (versioned scope + guardrails)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_agents (
  id              uuid primary key default extensions.uuid_generate_v4(),
  slug            text unique not null,
  name            text not null,
  short_desc      text not null,
  pillar          text not null,                  -- 'marketing','finance', etc. or 'cross'
  icon            text not null default 'sparkles',
  default_model   text not null default 'gpt-4o-mini',
  status          text not null default 'active'  -- 'active' | 'beta' | 'disabled'
                  check (status in ('active','beta','disabled')),
  -- Foreign key to the currently published version. Nullable while drafting.
  published_version_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.ai_agent_versions (
  id               uuid primary key default extensions.uuid_generate_v4(),
  agent_id         uuid not null references public.ai_agents(id) on delete cascade,
  version_label    text not null,                 -- e.g. 'v2.3.1'
  system_prompt    text not null,
  allowed_actions  jsonb not null default '[]'::jsonb,
                                                  -- [{key, label, note, on}]
  guardrails       jsonb not null default '[]'::jsonb,
                                                  -- [{label, detail, severity}]
  escalation       jsonb not null default '[]'::jsonb,
                                                  -- [{trigger, target}]
  knowledge_base   jsonb not null default '[]'::jsonb,
                                                  -- [{label, kind, size}]
  default_tone     text default 'Friendly + clear',
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);

create index if not exists ai_agent_versions_agent_idx
  on public.ai_agent_versions (agent_id, created_at desc);

alter table public.ai_agents
  add constraint ai_agents_published_version_fk
  foreign key (published_version_id) references public.ai_agent_versions(id)
  on delete set null;

alter table public.ai_agents          enable row level security;
alter table public.ai_agent_versions  enable row level security;

-- Read access: every authenticated user can read the catalog of agents and
-- their currently published version (needed by the tenant app's AI surfaces).
-- Older versions are platform-admin-only.
create policy ai_agents_select_all on public.ai_agents
  for select to authenticated using (true);

create policy ai_agent_versions_select_published on public.ai_agent_versions
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.ai_agents a
       where a.id = ai_agent_versions.agent_id
         and a.published_version_id = ai_agent_versions.id
    )
  );

-- Writes go through RPCs below (super_admin_save_agent_version /
-- super_admin_publish_agent_version). Direct writes are platform-admin only.
create policy ai_agents_admin_write on public.ai_agents
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy ai_agent_versions_admin_write on public.ai_agent_versions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ai_agent_usage_daily
--    Per-day roll-up of agent usage. Tenant-scoped reads (tenants see their
--    own usage); platform admins see everything.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_agent_usage_daily (
  id            uuid primary key default extensions.uuid_generate_v4(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  agent_slug    text not null,                   -- references ai_agents.slug
  day           date not null,
  invocations   integer not null default 0,
  tokens_in     integer not null default 0,
  tokens_out    integer not null default 0,
  failures      integer not null default 0,
  latency_ms_p50 integer,
  spend_cents   integer not null default 0,
  created_at    timestamptz not null default now()
);

create unique index if not exists ai_agent_usage_daily_uniq
  on public.ai_agent_usage_daily (business_id, agent_slug, day);

create index if not exists ai_agent_usage_daily_agent_day_idx
  on public.ai_agent_usage_daily (agent_slug, day desc);

alter table public.ai_agent_usage_daily enable row level security;

create policy ai_agent_usage_select_self_or_admin
  on public.ai_agent_usage_daily
  for select to authenticated
  using (
    business_id = public.current_business_id()
    or public.is_platform_admin()
  );

-- Writes via service-role / future ingestion only.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. super_admin_audit
--    Cross-tenant audit. Anything the super-admin app does that touches
--    another tenant is logged here so we can prove who did what to whom.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.super_admin_audit (
  id               uuid primary key default extensions.uuid_generate_v4(),
  admin_user_id    uuid references auth.users(id) on delete set null,
  admin_email      text,
  action           text not null,
  target_type      text,                       -- 'user','business','plan','addon','agent'
  target_id        text,
  target_business_id uuid references public.businesses(id) on delete set null,
  diff             jsonb,
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index if not exists super_admin_audit_recent_idx
  on public.super_admin_audit (created_at desc);

create index if not exists super_admin_audit_admin_idx
  on public.super_admin_audit (admin_user_id, created_at desc);

alter table public.super_admin_audit enable row level security;

create policy super_admin_audit_admin_only on public.super_admin_audit
  for select to authenticated
  using (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Open cross-tenant reads on key tables for platform admins
--    Existing policies (current_business_id() match) stay in place. We add
--    additional SELECT policies that grant access when the caller is a
--    platform admin.
-- ─────────────────────────────────────────────────────────────────────────
create policy businesses_select_admin on public.businesses
  for select to authenticated using (public.is_platform_admin());

create policy users_select_admin on public.users
  for select to authenticated using (public.is_platform_admin());

create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.is_platform_admin());

create policy invoices_select_admin on public.invoices
  for select to authenticated using (public.is_platform_admin());

create policy credit_ledger_select_admin on public.credit_ledger
  for select to authenticated using (public.is_platform_admin());

create policy business_addons_select_admin on public.business_addons
  for select to authenticated using (public.is_platform_admin());

-- Platform admins can also write to the marketplace catalog (status,
-- pricing, draft toggles). Tenants still only read it.
create policy marketplace_addons_admin_write on public.marketplace_addons
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Marketplace catalog: add a `status` column so super-admin can toggle
--    live ↔ draft without deleting rows. Defaults to 'live' for existing
--    rows. Tenant catalog queries filter by status='live'.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.marketplace_addons
  add column if not exists status text not null default 'live'
    check (status in ('live','draft','disabled'));

-- ─────────────────────────────────────────────────────────────────────────
-- 7b. Users: add an `is_suspended` boolean. When true the tenant app
--     refuses to load (handled in `require-pillar.ts`) and the row shows
--     a Suspended pill in super-admin.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists is_suspended boolean not null default false;

create index if not exists users_is_suspended_idx
  on public.users (is_suspended)
  where is_suspended = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. RPC: super_admin_grant_admin / super_admin_revoke_admin
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.super_admin_grant_admin(
  p_email text,
  p_user_id uuid default null,
  p_display_name text default null,
  p_notes text default null
) returns public.platform_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_row public.platform_admins%rowtype;
  v_row public.platform_admins%rowtype;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  select * into v_actor_row from public.platform_admins
   where user_id = v_actor and revoked_at is null limit 1;

  insert into public.platform_admins (user_id, email, display_name, notes, granted_by)
  values (p_user_id, lower(p_email), p_display_name, p_notes, v_actor_row.id)
  on conflict (email) do update
     set user_id      = coalesce(excluded.user_id, public.platform_admins.user_id),
         display_name = coalesce(excluded.display_name, public.platform_admins.display_name),
         notes        = coalesce(excluded.notes, public.platform_admins.notes),
         revoked_at   = null
  returning * into v_row;

  insert into public.super_admin_audit (admin_user_id, admin_email, action, target_type, target_id, diff)
  values (v_actor, (select email from public.platform_admins where user_id=v_actor limit 1),
          'platform_admin.grant', 'platform_admin', v_row.id::text,
          jsonb_build_object('email', lower(p_email)));
  return v_row;
end;
$$;

grant execute on function public.super_admin_grant_admin(text, uuid, text, text)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. RPC: super_admin_set_business_status
--    Suspend / restore a tenant. Stored as businesses.subscription_status.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.super_admin_set_business_status(
  p_business_id uuid,
  p_status      text,
  p_reason      text default null
) returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.businesses%rowtype;
  v_old text;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  if p_status not in ('active','past_due','cancelled','trial') then
    raise exception 'invalid status: %', p_status;
  end if;

  select subscription_status into v_old from public.businesses where id = p_business_id;
  update public.businesses
     set subscription_status = p_status,
         updated_at = now()
   where id = p_business_id
   returning * into v_row;

  if not found then raise exception 'business not found'; end if;

  insert into public.super_admin_audit (admin_user_id, admin_email, action, target_type, target_id, target_business_id, diff)
  values (v_actor,
          (select email from public.platform_admins where user_id=v_actor limit 1),
          'business.set_status', 'business', p_business_id::text, p_business_id,
          jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));

  return v_row;
end;
$$;

grant execute on function public.super_admin_set_business_status(uuid, text, text)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. RPC: super_admin_set_user_role / super_admin_suspend_user
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.super_admin_set_user_role(
  p_user_id uuid,
  p_role    text
) returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.users%rowtype;
  v_old text;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  if p_role not in ('owner','manager','accountant','hr_officer','cashier','staff') then
    raise exception 'invalid role: %', p_role;
  end if;

  select role into v_old from public.users where id = p_user_id;
  update public.users set role = p_role, updated_at = now()
   where id = p_user_id returning * into v_row;
  if not found then raise exception 'user not found'; end if;

  insert into public.super_admin_audit (admin_user_id, admin_email, action, target_type, target_id, target_business_id, diff)
  values (v_actor,
          (select email from public.platform_admins where user_id=v_actor limit 1),
          'user.set_role', 'user', p_user_id::text, v_row.business_id,
          jsonb_build_object('from', v_old, 'to', p_role));
  return v_row;
end;
$$;

grant execute on function public.super_admin_set_user_role(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. RPC: super_admin_save_agent_version / super_admin_publish_agent_version
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.super_admin_save_agent_version(
  p_agent_slug      text,
  p_version_label   text,
  p_system_prompt   text,
  p_allowed_actions jsonb,
  p_guardrails      jsonb,
  p_escalation      jsonb,
  p_knowledge_base  jsonb,
  p_default_tone    text default null,
  p_publish         boolean default true
) returns public.ai_agent_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_agent public.ai_agents%rowtype;
  v_row   public.ai_agent_versions%rowtype;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;

  select * into v_agent from public.ai_agents where slug = p_agent_slug;
  if not found then raise exception 'agent not found: %', p_agent_slug; end if;

  insert into public.ai_agent_versions
    (agent_id, version_label, system_prompt, allowed_actions, guardrails, escalation,
     knowledge_base, default_tone, created_by, published_at)
  values
    (v_agent.id, p_version_label, p_system_prompt,
     coalesce(p_allowed_actions, '[]'::jsonb),
     coalesce(p_guardrails, '[]'::jsonb),
     coalesce(p_escalation, '[]'::jsonb),
     coalesce(p_knowledge_base, '[]'::jsonb),
     coalesce(p_default_tone, v_agent.default_model),
     v_actor,
     case when p_publish then now() else null end)
  returning * into v_row;

  if p_publish then
    update public.ai_agents
       set published_version_id = v_row.id, updated_at = now()
     where id = v_agent.id;
  end if;

  insert into public.super_admin_audit
    (admin_user_id, admin_email, action, target_type, target_id, diff)
  values (v_actor,
          (select email from public.platform_admins where user_id=v_actor limit 1),
          case when p_publish then 'agent.publish' else 'agent.save_draft' end,
          'agent', p_agent_slug,
          jsonb_build_object(
            'version_id',    v_row.id,
            'version_label', p_version_label,
            'published',     p_publish
          ));
  return v_row;
end;
$$;

grant execute on function public.super_admin_save_agent_version(
  text, text, text, jsonb, jsonb, jsonb, jsonb, text, boolean
) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. RPC: super_admin_set_marketplace_status
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.super_admin_set_marketplace_status(
  p_addon_slug text,
  p_status     text
) returns public.marketplace_addons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.marketplace_addons%rowtype;
  v_old text;
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  if p_status not in ('live','draft','disabled') then
    raise exception 'invalid status: %', p_status;
  end if;

  select status into v_old from public.marketplace_addons where slug = p_addon_slug;
  update public.marketplace_addons set status = p_status
   where slug = p_addon_slug returning * into v_row;
  if not found then raise exception 'addon not found: %', p_addon_slug; end if;

  insert into public.super_admin_audit (admin_user_id, admin_email, action, target_type, target_id, diff)
  values (v_actor,
          (select email from public.platform_admins where user_id=v_actor limit 1),
          'marketplace.set_status', 'addon', p_addon_slug,
          jsonb_build_object('from', v_old, 'to', p_status));

  return v_row;
end;
$$;

grant execute on function public.super_admin_set_marketplace_status(text, text)
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 13. Seed initial AI agents + a v1 draft for each
-- ─────────────────────────────────────────────────────────────────────────
insert into public.ai_agents (slug, name, short_desc, pillar, icon, default_model, status)
values
  ('maya',         'Maya',          'Marketing copilot for SMBs',                   'marketing',  'sparkles',     'gpt-4o-mini',     'active'),
  ('ops',          'Operations AI', 'Inventory + dispatch helper',                  'operations', 'package',      'gpt-4o',          'active'),
  ('fin',          'Finance AI',    'Books, reconciliation, and e-invoice helper',  'finance',    'wallet',       'claude-3-5-sonnet','active'),
  ('boardroom',    'Boardroom AI',  'Cross-pillar strategy + KPIs',                 'cross',      'brain-circuit','gpt-4o',          'active'),
  ('hr',           'HR Helper',     'Leave + payroll Q&A',                          'hr',         'users',        'gpt-4o-mini',     'active'),
  ('concierge',    'Concierge',     'Tenant onboarding guide (preview)',            'cross',      'help-circle',  'gpt-4o-mini',     'beta')
on conflict (slug) do update set
  name = excluded.name,
  short_desc = excluded.short_desc,
  pillar = excluded.pillar,
  icon = excluded.icon,
  default_model = excluded.default_model,
  status = excluded.status;

-- Seed an initial v1 published version per agent. Idempotent via
-- "skip if any version already exists for that agent".
do $$
declare
  rec record;
  v_version_id uuid;
begin
  for rec in select * from public.ai_agents loop
    if exists (select 1 from public.ai_agent_versions where agent_id = rec.id) then
      continue;
    end if;

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
        jsonb_build_object('key', 'draft_artifact',    'label', 'Draft documents / posts / messages', 'note', 'Always presented as draft, never auto-sent', 'on', true),
        jsonb_build_object('key', 'execute_mutation', 'label', 'Execute mutations on behalf of owner', 'note', 'Requires owner confirmation', 'on', false)
      ),
      jsonb_build_array(
        jsonb_build_object('label','Send payments or move funds', 'detail','Blocked at tool layer', 'severity','always'),
        jsonb_build_object('label','Share customer PII with third parties', 'detail','Blocked unless tenant opts in via Marketplace addon', 'severity','always'),
        jsonb_build_object('label','Use crude language, profanity, or political content', 'detail','Style filter applied to every response', 'severity','always'),
        jsonb_build_object('label','Promise outcomes (e.g. "guaranteed sales")', 'detail','Suggest benchmarks with confidence ranges instead', 'severity','always'),
        jsonb_build_object('label','Bypass plan entitlements', 'detail','Reads lib/auth/entitlements.ts at runtime', 'severity','enforced')
      ),
      jsonb_build_array(
        jsonb_build_object('trigger','Confidence < 70%', 'target','ask owner for confirmation'),
        jsonb_build_object('trigger','Customer complaint detected', 'target','ping owner on Inbox'),
        jsonb_build_object('trigger','Failed action 3x in a row', 'target','open ticket to Bantu Niaga support')
      ),
      jsonb_build_array(
        jsonb_build_object('label','Tenant catalog (auto-sync)', 'kind','Live source', 'size','live'),
        jsonb_build_object('label','Malaysian public holiday calendar', 'kind','API', 'size','feed')
      ),
      'Friendly + clear',
      now()
    )
    returning id into v_version_id;

    update public.ai_agents set published_version_id = v_version_id, updated_at = now()
     where id = rec.id;
  end loop;
end$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 14. Seed deterministic usage data for the demo business so the dashboard
--     has something to show even before the AI gateway is wired.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_demo_id uuid := '11111111-1111-1111-1111-111111111111';
  v_agent   record;
  v_day     date;
begin
  -- Only seed if the demo business row exists.
  if not exists (select 1 from public.businesses where id = v_demo_id) then
    return;
  end if;

  for v_agent in select slug from public.ai_agents loop
    for i in 0..29 loop
      v_day := current_date - i;
      insert into public.ai_agent_usage_daily
        (business_id, agent_slug, day, invocations, tokens_in, tokens_out,
         failures, latency_ms_p50, spend_cents)
      values (
        v_demo_id, v_agent.slug, v_day,
        50 + ((extract(epoch from v_day)::int + length(v_agent.slug) * 7) % 40),
        4200 + ((extract(epoch from v_day)::int) % 1500),
        2100 + ((extract(epoch from v_day)::int) % 900),
        ((extract(epoch from v_day)::int) % 4),
        700 + ((extract(epoch from v_day)::int + length(v_agent.slug) * 13) % 400),
        ((extract(epoch from v_day)::int + length(v_agent.slug) * 17) % 800) + 200
      )
      on conflict (business_id, agent_slug, day) do nothing;
    end loop;
  end loop;
end$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 15. Bootstrap the platform_admins table with the founding super admin.
--     Looks up the email in auth.users and grants the role. NO-OP when the
--     email isn't registered yet (the founder can sign up first and re-run
--     this block, or insert via the SQL editor).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_seed_email text := 'asyraf@bantuniaga.demo';
  v_user_id    uuid;
begin
  select id into v_user_id from auth.users where lower(email) = v_seed_email limit 1;

  insert into public.platform_admins (user_id, email, display_name, notes)
  values (v_user_id, v_seed_email, 'Asyraf (founder)',
          'Bootstrap super admin. Seeded from migration 15.')
  on conflict (email) do update set
    user_id      = coalesce(public.platform_admins.user_id, excluded.user_id),
    display_name = coalesce(public.platform_admins.display_name, excluded.display_name),
    notes        = excluded.notes,
    revoked_at   = null;
end$$;
