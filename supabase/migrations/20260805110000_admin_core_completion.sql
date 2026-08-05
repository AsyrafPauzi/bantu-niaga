-- Admin core completion: public file shares, document templates, internal notes,
-- and cross-module notification feed.

-- ── Secure public share links on vault files ─────────────────────────────
alter table public.admin_files
  add column if not exists share_hash text,
  add column if not exists share_enabled_at timestamptz;

create unique index if not exists admin_files_share_hash_uidx
  on public.admin_files (share_hash)
  where share_hash is not null and deleted_at is null;

comment on column public.admin_files.share_hash is
  'Unguessable token for public /{idcompany}/file-{hash} links.';
comment on column public.admin_files.share_enabled_at is
  'When set, the share link is active. NULL revokes public access.';

-- ── Basic document templates (system + per-tenant later) ────────────────
create table if not exists public.admin_document_templates (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  slug        text not null,
  title       text not null,
  category    text not null default 'general',
  body_text   text not null,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.admin_document_templates is
  'Basic document templates. business_id NULL = platform defaults for all tenants.';

create unique index if not exists admin_document_templates_system_slug_uidx
  on public.admin_document_templates (slug)
  where business_id is null;

create unique index if not exists admin_document_templates_tenant_slug_uidx
  on public.admin_document_templates (business_id, slug)
  where business_id is not null;

create index if not exists admin_document_templates_list_idx
  on public.admin_document_templates (business_id, sort_order);

drop trigger if exists admin_document_templates_set_updated_at on public.admin_document_templates;
create trigger admin_document_templates_set_updated_at
  before update on public.admin_document_templates
  for each row execute function public.set_updated_at();

alter table public.admin_document_templates enable row level security;

drop policy if exists admin_document_templates_select on public.admin_document_templates;
create policy admin_document_templates_select on public.admin_document_templates
  for select to authenticated
  using (
    business_id is null
    or business_id = public.current_business_id()
  );

drop policy if exists admin_document_templates_write on public.admin_document_templates;
create policy admin_document_templates_write on public.admin_document_templates
  for all to authenticated
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

insert into public.admin_document_templates (
  business_id, slug, title, category, body_text, sort_order
)
values
  (
    null,
    'receipt-acknowledgement',
    'Receipt acknowledgement',
    'finance',
    E'Date: [DATE]\n\nDear [NAME],\n\nThis confirms we received your payment of RM [AMOUNT] on [DATE].\n\nThank you for your business.\n\n[BUSINESS NAME]',
    10
  ),
  (
    null,
    'supplier-intro',
    'Supplier introduction letter',
    'operations',
    E'Date: [DATE]\n\nTo: [SUPPLIER NAME]\n\nWe would like to introduce [BUSINESS NAME] as a buyer for [PRODUCT/SERVICE].\n\nPlease share your catalogue and payment terms at your earliest convenience.\n\nRegards,\n[YOUR NAME]\n[BUSINESS NAME]',
    20
  ),
  (
    null,
    'tenancy-reminder',
    'Tenancy renewal reminder',
    'compliance',
    E'Subject: Tenancy agreement renewal — [PREMISES]\n\nDear [LANDLORD NAME],\n\nOur tenancy at [ADDRESS] expires on [DATE]. We wish to renew and request updated terms.\n\nPlease confirm availability for a meeting this week.\n\nRegards,\n[BUSINESS NAME]',
    30
  ),
  (
    null,
    'ssm-renewal-checklist',
    'SSM renewal checklist',
    'compliance',
    E'SSM / business registration renewal checklist:\n\n1. Confirm expiry date on current certificate\n2. Prepare latest bank statement / utility bill (if required)\n3. Pay renewal fee via MySSM\n4. Upload new certificate to Admin → Storage → Licences\n5. Update compliance tracker due date',
    40
  ),
  (
    null,
    'internal-memo',
    'Internal memo',
    'general',
    E'MEMO\n\nTo: [TEAM / PERSON]\nFrom: [YOUR NAME]\nDate: [DATE]\nRe: [SUBJECT]\n\n[BODY]\n\nAction required by: [DATE]',
    50
  ),
  (
    null,
    'meeting-minutes',
    'Meeting minutes (simple)',
    'general',
    E'Meeting: [TITLE]\nDate: [DATE]\nAttendees: [NAMES]\n\nAgenda:\n1. [ITEM]\n2. [ITEM]\n\nDecisions:\n- [DECISION]\n\nNext actions:\n- [OWNER] — [TASK] — due [DATE]',
    60
  )
on conflict (slug) where business_id is null do update set
  title = excluded.title,
  category = excluded.category,
  body_text = excluded.body_text,
  sort_order = excluded.sort_order;

-- ── Internal notes (owner/manager scratchpad) ───────────────────────────
create table if not exists public.admin_internal_notes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  body        text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.admin_internal_notes is
  'Short internal admin notes visible to owner/manager within the business.';

create index if not exists admin_internal_notes_business_idx
  on public.admin_internal_notes (business_id, created_at desc);

drop trigger if exists admin_internal_notes_set_updated_at on public.admin_internal_notes;
create trigger admin_internal_notes_set_updated_at
  before update on public.admin_internal_notes
  for each row execute function public.set_updated_at();

alter table public.admin_internal_notes enable row level security;

drop policy if exists admin_internal_notes_select on public.admin_internal_notes;
create policy admin_internal_notes_select on public.admin_internal_notes
  for select to authenticated
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists admin_internal_notes_insert on public.admin_internal_notes;
create policy admin_internal_notes_insert on public.admin_internal_notes
  for insert to authenticated
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
    and created_by = auth.uid()
  );

drop policy if exists admin_internal_notes_delete on public.admin_internal_notes;
create policy admin_internal_notes_delete on public.admin_internal_notes
  for delete to authenticated
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- ── Business notification feed (admin pillar first) ─────────────────────
create table if not exists public.business_notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pillar      text not null default 'admin'
              check (pillar in ('admin','finance','operations','sales','marketing','hr','ai')),
  event_type  text not null,
  message     text not null check (char_length(trim(message)) > 0),
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.business_notifications is
  'In-app activity feed per tenant. Inserted server-side; read by business members.';

create index if not exists business_notifications_business_created_idx
  on public.business_notifications (business_id, created_at desc);

alter table public.business_notifications enable row level security;

drop policy if exists business_notifications_select on public.business_notifications;
create policy business_notifications_select on public.business_notifications
  for select to authenticated
  using (business_id = public.current_business_id());
