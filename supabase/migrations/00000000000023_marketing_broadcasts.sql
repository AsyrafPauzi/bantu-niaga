-- ============================================================================
-- Bantu Niaga — Marketing v1.1, Phase 2B: broadcasts + broadcast_recipients
-- ============================================================================
-- Lands the broadcasts portion of the v1.1 spec
-- (docs/superpowers/specs/2026-06-15-marketing-segments-broadcasts-coupons-design.md
--  §3, §7, §8). The sibling phase-2 worker is shipping coupons in
-- 00000000000022_marketing_coupons.sql; the broadcasts and coupons
-- migrations run in parallel so this file deliberately does NOT add a
-- foreign-key constraint on `broadcasts.coupon_id` — see the inline
-- comment on the column.
--
-- What lands here:
--   1. public.broadcasts — one row per WhatsApp click-to-chat or email
--      broadcast. Status flows draft → sending → sent / partially_sent / failed.
--   2. public.broadcast_recipients — one row per (broadcast, customer)
--      snapshot, with the rendered message and per-recipient send status.
--   3. Indexes for the common surfaces (recent broadcasts per business,
--      recipient lookups by status).
--   4. RLS per spec §3:
--        - broadcasts: SELECT same-biz; INSERT/UPDATE owner+manager;
--          DELETE owner-only AND status='draft'.
--        - broadcast_recipients: SELECT same-biz via parent broadcast;
--          INSERT/UPDATE service-role only; cascade DELETE.
--   5. `set_updated_at` trigger on broadcasts.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- broadcasts
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,

  name            text not null check (length(name) between 1 and 120),
  channel         text not null check (channel in ('whatsapp_ctc', 'email')),
  segment_id      uuid not null
                  references public.customer_segments(id) on delete restrict,

  -- Email-only field. NULL for whatsapp_ctc; enforced by the CHECK below.
  subject         text,
  -- Supports placeholders: {name}, {first_name}, {coupon_code}.
  message_template text not null
                  check (length(message_template) between 1 and 4000),

  -- Parallelism note: the sibling coupons worker is shipping
  -- 00000000000022_marketing_coupons.sql at the same time as this
  -- migration. We deliberately do NOT add a foreign-key constraint
  -- here because `public.coupons` may not exist yet when this
  -- migration applies. The column is enforced at the API layer
  -- (lib/marketing/broadcasts.ts) and the column will be promoted to
  -- a referential FK in a follow-up migration once the coupons table
  -- is live in every environment.
  coupon_id       uuid,

  status          text not null default 'draft'
                  check (status in ('draft', 'sending', 'sent', 'failed', 'partially_sent')),
  total_recipients integer not null default 0,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,

  -- Column ships per spec; no worker fires it in v1.1.
  scheduled_at    timestamptz,
  sent_at         timestamptz,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- whatsapp_ctc broadcasts have no subject line (the WA prefill is plain).
  constraint broadcasts_subject_email_only
    check (channel = 'email' or subject is null)
);

comment on table public.broadcasts is
  'WhatsApp click-to-chat or email broadcasts. One row per campaign. broadcast_recipients holds the per-customer snapshots once status leaves draft.';
comment on column public.broadcasts.coupon_id is
  'Optional reference to public.coupons.id. No FK constraint: the coupons table is shipped by a sibling migration that may run before or after this one. The API layer enforces existence.';

create index if not exists broadcasts_business_created_idx
  on public.broadcasts (business_id, created_at desc);

create index if not exists broadcasts_business_status_idx
  on public.broadcasts (business_id, status);

drop trigger if exists broadcasts_set_updated_at on public.broadcasts;
create trigger broadcasts_set_updated_at
  before update on public.broadcasts
  for each row execute function public.set_updated_at();

alter table public.broadcasts enable row level security;

-- SELECT: same business. (No soft-delete on broadcasts; status='failed'
-- and a hard-delete path on drafts handle the housekeeping.)
drop policy if exists "broadcasts_select_self_business" on public.broadcasts;
create policy "broadcasts_select_self_business" on public.broadcasts
  for select
  using (business_id = public.current_business_id());

-- INSERT: owner/manager only.
drop policy if exists "broadcasts_insert_self_business" on public.broadcasts;
create policy "broadcasts_insert_self_business" on public.broadcasts
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );

-- UPDATE: owner/manager only. The status machine (draft → sending →
-- sent/failed/partially_sent) is enforced in the API; RLS only gates
-- the actor.
drop policy if exists "broadcasts_update_self_business" on public.broadcasts;
create policy "broadcasts_update_self_business" on public.broadcasts
  for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (business_id = public.current_business_id());

-- DELETE: owner only AND only when status='draft'. The DB enforces
-- both constraints so a UI bug can't drop a sent broadcast.
drop policy if exists "broadcasts_delete_owner_drafts_only" on public.broadcasts;
create policy "broadcasts_delete_owner_drafts_only" on public.broadcasts
  for delete
  using (
    business_id = public.current_business_id()
    and public.current_role() = 'owner'
    and status = 'draft'
  );

-- ─────────────────────────────────────────────────────────────────────────
-- broadcast_recipients
-- One row per (broadcast, customer) at send-resolution time. Snapshot of
-- channel address + rendered message so future profile edits don't
-- rewrite send history.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcast_recipients (
  id               uuid primary key default gen_random_uuid(),
  broadcast_id     uuid not null references public.broadcasts(id) on delete cascade,
  customer_id      uuid not null references public.customers(id) on delete restrict,

  -- Snapshot at send-time. phone for whatsapp_ctc, email for email.
  channel_address  text not null,
  rendered_message text not null,
  rendered_subject text,

  status           text not null default 'queued'
                   check (status in ('queued', 'sent', 'failed', 'opened')),
  error            text,
  sent_at          timestamptz,
  -- email-only. Not wired in v1.1; column ships for forward-compat.
  opened_at        timestamptz,

  unique (broadcast_id, customer_id)
);

comment on table public.broadcast_recipients is
  'Per-customer snapshot rows created when a broadcast leaves draft. Service-role inserts during the /send handler; the click-to-chat tap-tracker updates status to sent.';

create index if not exists broadcast_recipients_broadcast_status_idx
  on public.broadcast_recipients (broadcast_id, status);

create index if not exists broadcast_recipients_customer_idx
  on public.broadcast_recipients (customer_id);

alter table public.broadcast_recipients enable row level security;

-- SELECT: same business via parent broadcast. We deliberately mirror
-- the parent's business_id through an EXISTS clause so the policy
-- stays tenant-scoped even though broadcast_recipients itself does
-- not carry business_id.
drop policy if exists "broadcast_recipients_select_via_parent" on public.broadcast_recipients;
create policy "broadcast_recipients_select_via_parent" on public.broadcast_recipients
  for select
  using (
    exists (
      select 1
      from public.broadcasts b
      where b.id = broadcast_recipients.broadcast_id
        and b.business_id = public.current_business_id()
    )
  );

-- INSERT / UPDATE / DELETE: no public policy. The /send handler and
-- the mark-sent handler perform these writes via service-role.
-- Without an INSERT policy, RLS rejects every authenticated INSERT —
-- the API surface is the only path. Cascade-on-delete via the parent
-- broadcast row still works because cascades bypass RLS.
