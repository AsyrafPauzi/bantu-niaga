-- Super-admin insights: per-tenant model override, health snapshots, AI usage rollup.

-- ── Per-tenant model override (platform admin can force a model) ─────────────
alter table public.business_agent_settings
  add column if not exists model_override text;

comment on column public.business_agent_settings.model_override is
  'When set by platform admin, overrides reasoning_mode model mapping for this tenant+agent.';

-- ── Tenant health snapshots (computed by cron) ───────────────────────────────
create table if not exists public.tenant_health_snapshots (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  band text not null check (band in ('healthy', 'watch', 'at_risk', 'critical')),
  signals jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists tenant_health_snapshots_band_idx
  on public.tenant_health_snapshots (band, score desc);

alter table public.tenant_health_snapshots enable row level security;

-- Platform admins read via service role only; no tenant policy needed.

-- ── Roll up live ai_usage into ai_agent_usage_daily (for super-admin KPIs) ─
create or replace function public.rollup_ai_agent_usage_daily(p_day date default (current_date - 1))
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  insert into public.ai_agent_usage_daily (
    business_id,
    agent_slug,
    day,
    invocations,
    spend_cents,
    latency_ms_p50,
    failures
  )
  select
    u.business_id,
    u.agent_slug,
    p_day,
    count(*)::integer,
    coalesce(sum(round((u.cost_myr_estimated * 100)::numeric)), 0)::integer,
    null::integer,
    count(*) filter (
      where coalesce(u.metadata->>'failed', 'false') = 'true'
        or u.metadata ? 'error'
    )::integer
  from public.ai_usage u
  where u.created_at >= p_day::timestamptz
    and u.created_at < (p_day + 1)::timestamptz
  group by u.business_id, u.agent_slug
  on conflict on constraint ai_agent_usage_daily_uniq do update set
    invocations = excluded.invocations,
    spend_cents = excluded.spend_cents,
    latency_ms_p50 = excluded.latency_ms_p50,
    failures = excluded.failures;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.rollup_ai_agent_usage_daily(date) to service_role;
