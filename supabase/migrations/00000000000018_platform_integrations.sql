-- ============================================================================
-- 00000000000018_platform_integrations.sql
--
-- Platform-wide API integrations registry.
--
-- One row per integration (OpenAI, WhatsApp Cloud, Billplz, ...). Platform
-- admins manage these from /super-admin/integrations; the rest of the app
-- reads them via `lib/integrations/load.ts`.
--
-- Security model:
--   - Only platform admins can SELECT / INSERT / UPDATE.
--   - The `encrypted_credentials` column holds an AES-256-GCM payload
--     produced by `lib/integrations/crypto.ts`. The encryption key lives in
--     INTEGRATION_ENCRYPTION_KEY (env var) and never touches the DB.
--   - Non-secret configuration (model names, environment flags, etc.)
--     lives in the plain `config` jsonb column.
--   - The slug is the primary key (kebab-case identifier, matches the
--     catalog descriptor in `lib/integrations/catalog.ts`).
-- ============================================================================

create table if not exists public.platform_integrations (
  slug                   text primary key,
  category               text not null,
  display_name           text not null,

  enabled                boolean not null default false,

  -- Non-secret configuration (default model, environment, region, etc.).
  config                 jsonb not null default '{}'::jsonb,

  -- Secrets: serialised as
  --   { v: 1, alg: 'AES-256-GCM',
  --     fields: { api_key: { iv, ciphertext, tag }, … } }
  -- Encryption + decryption happens entirely in the application layer.
  encrypted_credentials  jsonb,

  -- Lightweight smoke-test state populated by /api/super-admin/integrations/[slug]/test.
  test_status            text not null default 'untested'
                         check (test_status in ('untested', 'ok', 'fail')),
  last_tested_at         timestamptz,
  last_test_error        text,

  updated_by_admin_id    uuid references auth.users(id) on delete set null,
  updated_by_admin_email text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.platform_integrations is
  'Platform-wide API integrations (OpenAI, WhatsApp, Billplz, …). One row '
  'per slug. Credentials are AES-256-GCM encrypted in encrypted_credentials.';

create index if not exists platform_integrations_category_idx
  on public.platform_integrations (category);
create index if not exists platform_integrations_enabled_idx
  on public.platform_integrations (enabled);

alter table public.platform_integrations enable row level security;

create policy platform_integrations_admin_select
  on public.platform_integrations
  for select to authenticated
  using (public.is_platform_admin());

create policy platform_integrations_admin_write
  on public.platform_integrations
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Re-use the existing touch trigger if available, otherwise no-op.
drop trigger if exists platform_integrations_touch on public.platform_integrations;
create trigger platform_integrations_touch
  before update on public.platform_integrations
  for each row execute function public._touch_updated_at();
