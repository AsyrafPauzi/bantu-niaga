# Marketing Core v1.1 — Segments, Broadcasts, Coupons

> **Status:** Approved 2026-06-15
> **Companion to:** `docs/plans/marketing-implementation-plan.md`, `docs/plans/marketing-decisions.md`
> **Why this doc exists:** v1 deferred Segments (custom), Broadcasts, and Coupons to marketplace add-ons. The product owner has reversed that decision and pulled them into core. This spec defines the realistic v1.1 scope.

---

## 1. Why this work, why now

The original v1 Marketing scope (M1–M6) shipped the customer-record loop end-to-end: schema, RLS, CRM list/detail, CSV import/export, auto-tagging, content calendar, and KPI dashboard. The five auto-tags (`vip`, `repeat`, `new`, `at_risk`, `dormant`) already exist as boolean flags on every customer.

What's missing from a real SME's perspective:

1. They can _see_ their cohorts but cannot _act_ on them — no way to message a segment.
2. They cannot run promotions; coupon codes live in WhatsApp screenshots, not in the system.
3. The five auto-tags are useful but rigid; SMEs want to save their own filters (e.g. "spent ≥ RM500 in last 90 days, source=facebook_lead").

This spec lands the action layer: **save a cohort → send them a message → optionally include a coupon → track redemption.** It is intentionally narrower than the marketplace-grade "WA Broadcast Manager" or "Promo Engine" add-ons.

---

## 2. Out of scope (explicit)

These ship in marketplace add-ons or v2, not here:

- WhatsApp Cloud API push (blocked on Meta App Review)
- Email open/click tracking pixels
- Buy-X-get-Y, free-shipping, BOGO coupons (only `PCT` and `AMT`)
- Drip campaigns, automation triggers, A/B subject lines
- A scheduled-send worker (column ships; cron-driven send does not)
- UTM-attributed coupons (Smart Link Tracker is its own add-on)
- Per-recipient open/click analytics dashboards

---

## 3. Data model

Five new tables. All scoped by `business_id`, all RLS-protected with the same `current_business_id() / current_role()` pattern as `customers`.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- customer_segments
-- One row per saved cohort. `kind='auto'` rows are seeded per-business at
-- migration time (one per auto-tag). `kind='custom'` rows are user-created
-- with a JSON rules document.
-- ─────────────────────────────────────────────────────────────────────────
create table public.customer_segments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,

  name            text not null check (length(name) between 1 and 80),
  kind            text not null check (kind in ('auto', 'custom')),
  auto_key        text check (auto_key in ('vip','repeat','new','at_risk','dormant')),
  rules           jsonb,             -- null when kind='auto'

  -- Cached counts (refreshed on read; cheap because resolver is a single SQL query).
  member_count    integer not null default 0,
  member_count_at timestamptz,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  -- One auto segment per (business, auto_key)
  unique (business_id, auto_key) deferrable initially deferred,
  -- Custom segments must have rules; auto segments must not
  check (
    (kind = 'auto'   and auto_key is not null and rules is null)
    or
    (kind = 'custom' and auto_key is null     and rules is not null)
  )
);
```

`rules` JSON shape (custom segments only):

```jsonc
{
  "tags_any":         ["facebook_lead", "homestay_guest"],   // OR within array
  "min_spend_myr":    500,                                   // inclusive
  "max_spend_myr":    null,                                  // null = no cap
  "inactive_days":    90,                                    // last_purchase older than N days
  "sources":          ["facebook_lead", "manual"],           // customer.source IN
  "manual_tags_any":  ["wholesale"],                         // any of these manual_tags
  "auto_tags_any":    ["vip", "at_risk"]                     // OR with above tags_any
}
```

All rule keys are optional. An empty rules object matches every active customer.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- broadcasts
-- ─────────────────────────────────────────────────────────────────────────
create table public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,

  name            text not null check (length(name) between 1 and 120),
  channel         text not null check (channel in ('whatsapp_ctc','email')),
  segment_id      uuid not null references public.customer_segments(id) on delete restrict,

  -- Email-only fields. NULL for whatsapp_ctc.
  subject         text,
  -- Common fields. Supports placeholders: {name}, {first_name}, {coupon_code}
  message_template text not null check (length(message_template) between 1 and 4000),

  coupon_id       uuid references public.coupons(id) on delete set null,

  status          text not null default 'draft'
                  check (status in ('draft','sending','sent','failed','partially_sent')),
  total_recipients integer not null default 0,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,

  scheduled_at     timestamptz,        -- column ships; no worker fires it in v1.1
  sent_at          timestamptz,

  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  check (channel = 'email' or subject is null)  -- whatsapp_ctc has no subject
);

-- ─────────────────────────────────────────────────────────────────────────
-- broadcast_recipients
-- One row per (broadcast, customer) at send-resolution time. Snapshot of
-- channel address + rendered message so future profile edits don't rewrite
-- send history.
-- ─────────────────────────────────────────────────────────────────────────
create table public.broadcast_recipients (
  id               uuid primary key default gen_random_uuid(),
  broadcast_id     uuid not null references public.broadcasts(id) on delete cascade,
  customer_id      uuid not null references public.customers(id) on delete restrict,

  channel_address  text not null,         -- phone (whatsapp_ctc) or email
  rendered_message text not null,
  rendered_subject text,

  status           text not null default 'queued'
                   check (status in ('queued','sent','failed','opened')),
  error            text,
  sent_at          timestamptz,
  opened_at        timestamptz,           -- email only, not wired in v1.1

  unique (broadcast_id, customer_id)
);
```

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- coupons
-- ─────────────────────────────────────────────────────────────────────────
create table public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,

  code                text not null check (length(code) between 3 and 32),
  type                text not null check (type in ('PCT','AMT')),
  value               numeric(10,2) not null check (value > 0),
  -- PCT: 0 < value <= 100. AMT: any positive ringgit. Enforced in API + this CHECK.
  check (type <> 'PCT' or (value > 0 and value <= 100)),

  min_subtotal_myr    numeric(10,2) not null default 0 check (min_subtotal_myr >= 0),
  valid_from          timestamptz not null default now(),
  valid_until         timestamptz,        -- null = no expiry
  total_limit         integer,            -- null = unlimited
  per_customer_limit  integer not null default 1,

  segment_id          uuid references public.customer_segments(id) on delete set null,

  status              text not null default 'active'
                      check (status in ('active','paused','expired')),
  redeemed_count      integer not null default 0,

  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  unique (business_id, lower(code))       -- case-insensitive code uniqueness
);

-- ─────────────────────────────────────────────────────────────────────────
-- coupon_redemptions
-- ─────────────────────────────────────────────────────────────────────────
create table public.coupon_redemptions (
  id                    uuid primary key default gen_random_uuid(),
  coupon_id             uuid not null references public.coupons(id) on delete restrict,
  customer_id           uuid references public.customers(id) on delete set null,
  order_ref             text,                -- free-form; future POS sale_id, invoice_id, etc.
  discount_amount_myr   numeric(10,2) not null check (discount_amount_myr > 0),
  redeemed_by           uuid references auth.users(id) on delete set null,
  redeemed_at           timestamptz not null default now()
);
```

### RLS contract

| Table | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `customer_segments` | same biz, not soft-deleted | owner, manager | denied (soft-delete only) |
| `broadcasts` | same biz | owner, manager | owner only, draft only |
| `broadcast_recipients` | same biz via parent | service-role only (server inserts) | cascade |
| `coupons` | same biz, not soft-deleted | owner, manager | denied (soft-delete only) |
| `coupon_redemptions` | same biz via parent coupon | owner, manager, **cashier** | denied |

`cashier` gets INSERT on `coupon_redemptions` so the future POS can record redemptions. `cashier` does NOT get any read/write on `coupons` itself; the validate/redeem API is the only path.

---

## 4. API surface

All routes live under `/api/marketing/*` and follow the existing M1–M6 conventions: `getCurrentUser()` + `canSurface()` gate before any DB call, RLS as defense-in-depth.

### Segments

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/marketing/segments` | List active segments (auto + custom). Returns `member_count`. |
| POST | `/api/marketing/segments` | Create a custom segment. Validates rules JSON. |
| GET | `/api/marketing/segments/[id]` | Detail incl. rules, member count. |
| PATCH | `/api/marketing/segments/[id]` | Edit name + rules (custom only). |
| DELETE | `/api/marketing/segments/[id]` | Soft-delete (custom only). Auto segments are non-deletable. |
| GET | `/api/marketing/segments/[id]/members?limit=&cursor=` | Paginated customer rows matching this segment's rules. |

The resolver compiles the rules JSON to a single parameterized SQL `WHERE` clause against `customers`. No client-side filtering; the SQL must run with RLS on for the caller's session.

### Broadcasts

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/marketing/broadcasts` | List with status, recipient counts. |
| POST | `/api/marketing/broadcasts` | Create draft. Body: `{name, channel, segment_id, subject?, message_template, coupon_id?}` |
| GET | `/api/marketing/broadcasts/[id]` | Detail. |
| DELETE | `/api/marketing/broadcasts/[id]` | Hard-delete; only allowed when status='draft'. |
| POST | `/api/marketing/broadcasts/[id]/send` | Resolve recipients → render messages → for `whatsapp_ctc`, return list; for `email`, batch-send via Resend. Updates status. |
| POST | `/api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent` | CTC tap-tracker; sets recipient.status='sent', bumps broadcast.sent_count. |

`whatsapp_ctc` send response shape:

```json
{
  "broadcast_id": "...",
  "channel": "whatsapp_ctc",
  "recipients": [
    {
      "id": "uuid",
      "customer_name": "Aida",
      "phone": "+60123456789",
      "wa_url": "https://wa.me/60123456789?text=Hi%20Aida...",
      "rendered_message": "Hi Aida, this Friday only...",
      "status": "queued"
    }
  ]
}
```

The UI then renders this list with per-row tap-tracker buttons.

For `email`: server batches up to 100 recipients per Resend call (their batch endpoint), records per-recipient `sent` or `failed`, updates aggregate counts.

### Coupons

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/marketing/coupons` | List. |
| POST | `/api/marketing/coupons` | Create. Optional auto-generate code. |
| GET | `/api/marketing/coupons/[id]` | Detail incl. redemption count + recent redemptions. |
| PATCH | `/api/marketing/coupons/[id]` | Edit (name / value / dates / status). Code is immutable. |
| DELETE | `/api/marketing/coupons/[id]` | Soft-delete; blocks if `redeemed_count > 0`, owner must use 'paused' status instead. |
| POST | `/api/marketing/coupons/validate` | `{code, customer_id?, subtotal_myr}` → `{ok, discount_myr, reason?}`. **No state mutation.** |
| POST | `/api/marketing/coupons/redeem` | `{code, customer_id?, order_ref?, subtotal_myr}` → records `coupon_redemptions` row, increments counter. Idempotent on `(coupon_id, order_ref)` when `order_ref` is provided. |

Validate failure reasons (string enum):
- `not_found`, `paused`, `expired`, `not_yet_active`, `min_subtotal`, `total_limit_reached`, `per_customer_limit_reached`, `segment_mismatch`

Redeem permissions: owner OR manager OR `current_role() = 'cashier'` (to forward-compat the POS).

---

## 5. UI surfaces

10 pages plus 1 POS bonus.

### Segments
- `/marketing/segments` — table: name, kind (badge auto/custom), member count, last refreshed. Auto segments pinned at top. "New segment" CTA.
- `/marketing/segments/new` — rule builder form (chip-input for tags, two number inputs for spend range, days-since-purchase slider, source multi-select). Live "members preview: ~N customers" on debounce.
- `/marketing/segments/[id]` — left panel: rules summary (read-only for auto). Right panel: paginated customer table from members API. "Edit" button (custom only) opens the rule builder modal.

### Broadcasts
- `/marketing/broadcasts` — table: name, channel icon, segment, status badge, sent/total, created.
- `/marketing/broadcasts/new` — 4-step wizard:
  1. Channel (CTC vs Email)
  2. Segment dropdown + member count
  3. Template editor with `{name}/{first_name}/{coupon_code}` chips. Coupon dropdown (optional).
  4. Preview: shows first 3 rendered messages + recipient count + "Send now" button.
- `/marketing/broadcasts/[id]` — header: status, totals. Body: per-recipient table. For CTC: each row has a "Open WhatsApp" link (opens `wa_url`) and a "Mark sent" button next to it. For email: shows status pill + error if any.

### Coupons
- `/marketing/coupons` — table: code, type/value, valid window, redemptions/limit, status. Status pill toggle (active ↔ paused) inline.
- `/marketing/coupons/new` — form: code (auto-generate button), type radio, value, min subtotal, valid range, total/per-customer limits, segment scope dropdown.
- `/marketing/coupons/[id]` — left: editable form. Right: redemption log table with customer name + ringgit + when. Copy-link button → copies the wa.me-friendly URL.

### Sales POS bonus
- `/sales/pos` — keep the PillarStub but add a small footer card: "Have a coupon code? [____] [Apply]" that POSTs to `/api/marketing/coupons/validate` and shows the discount math. This is forward-compat plumbing — when the real POS lands it inherits the same API.

---

## 6. Cross-pillar / event hooks

- `marketing.broadcast.sent` (per broadcast, after send finishes) — payload includes broadcast_id, segment_id, channel, sent_count.
- `marketing.coupon.redeemed` (per redemption) — payload includes coupon_id, customer_id, order_ref, discount_amount_myr.

Both emitted to `events_outbox` using the existing M6 outbox pattern. No listeners ship in v1.1; they land when downstream pillars want them.

---

## 7. Permissions matrix delta

Add three new surfaces to `lib/permissions.ts` under the `marketing` pillar:

```ts
marketing: {
  // existing: customers, content
  segments:   { owner: 'rw', manager: 'rw', accountant: '-', hr_officer: '-', cashier: '-', staff: '-' },
  broadcasts: { owner: 'rw', manager: 'rw', accountant: '-', hr_officer: '-', cashier: '-', staff: '-' },
  coupons:    { owner: 'rw', manager: 'rw', accountant: '-', hr_officer: '-', cashier: '-', staff: '-' },
}
```

Plus a cross-pillar exception: cashier is allowed `INSERT` on `coupon_redemptions` (table-level) and `POST` on `/api/marketing/coupons/validate` + `/redeem`. This is the same pattern Q11 of the v1 decisions doc used for `/api/sales/pos/customer-search`.

---

## 8. Channel infra

### WhatsApp click-to-chat
Pure URL generation — no Meta deps:
```ts
const url = `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
```
Owner taps each link in the broadcast detail page; their phone's WhatsApp opens prefilled. They tap send. Then they tap "Mark sent" in the app to log it.

### Email via Resend
- Env: `RESEND_API_KEY`, `MARKETING_FROM_EMAIL` (defaults to `noreply@<your-domain>`).
- Resend free tier: 3,000 emails/month, 100/day. We chunk into 100-recipient batches.
- Without env: send returns 412 with body `{error:"email_channel_not_configured", missing:["RESEND_API_KEY","MARKETING_FROM_EMAIL"]}`. UI shows "Configure email in Settings → Integrations" banner.
- DKIM/SPF setup is the operator's responsibility (Resend dashboard); not modeled here.

---

## 9. File layout

```
lib/marketing/
  segments.ts          # rule resolver (rules JSON → SQL where), member-count helper
  segments-rules.ts    # rules JSON shape, zod schema, type guards
  broadcasts.ts        # template renderer, CTC URL gen, Resend client + batching
  coupons.ts           # validate/redeem core, code generator (8-char alnum)

app/api/marketing/segments/
  route.ts                              GET, POST
  [id]/route.ts                         GET, PATCH, DELETE
  [id]/members/route.ts                 GET

app/api/marketing/broadcasts/
  route.ts                              GET, POST
  [id]/route.ts                         GET, DELETE
  [id]/send/route.ts                    POST
  [id]/recipients/[rid]/mark-sent/route.ts   POST

app/api/marketing/coupons/
  route.ts                              GET, POST
  [id]/route.ts                         GET, PATCH, DELETE
  validate/route.ts                     POST
  redeem/route.ts                       POST

app/(app)/marketing/segments/
  page.tsx                  list
  new/page.tsx              rule builder
  [id]/page.tsx             detail

app/(app)/marketing/broadcasts/
  page.tsx                  list
  new/page.tsx              compose wizard
  [id]/page.tsx             detail

app/(app)/marketing/coupons/
  page.tsx                  list
  new/page.tsx              create form
  [id]/page.tsx             detail + log

components/marketing/
  SegmentRuleBuilder.tsx
  SegmentMemberCount.tsx
  BroadcastComposer.tsx
  BroadcastRecipientRow.tsx
  CouponForm.tsx
  CouponStatusBadge.tsx

supabase/migrations/
  00000000000020_marketing_segments_broadcasts_coupons.sql

tests/marketing/
  segments-rules.test.ts            unit: resolver
  segments-api.test.ts              integration
  segments-rls.test.ts              cross-tenant deny
  broadcasts-render.test.ts         unit: template + CTC link
  broadcasts-api.test.ts            integration
  broadcasts-rls.test.ts
  coupons-validate.test.ts          unit: every failure reason
  coupons-api.test.ts               integration incl. cashier redeem
  coupons-rls.test.ts
```

---

## 10. Tests

Same staging as M1–M6:
- **Unit:** rule resolver (auto + custom rules JSON variations), CTC link gen (foreign phones, edge chars), email template substitution (missing field fallback to empty string), coupon validate every failure reason.
- **API integration:** every route happy path + role-denied path + cross-tenant denial.
- **RLS:** each new table — same-tenant select succeeds, cross-tenant select returns zero rows, role-denied insert returns 42501.

Goal: each new test file ≤ 200 lines, single concern.

---

## 11. Migration order & data seeding

1. Single migration `00000000000020_marketing_segments_broadcasts_coupons.sql` lands all 5 tables, indexes, RLS policies, and seeds the 5 auto segments per existing business via `INSERT … SELECT FROM businesses`.
2. After migration applies, a one-shot script (`scripts/seed-demo-marketing-extras.ts`) populates the demo business with:
   - 1 custom segment ("Big spenders, last 90 days")
   - 2 coupons (one PCT-20, one AMT-RM10 with limit=50)
   - 1 sent broadcast (CTC channel, fully populated recipient table)
   - 1 draft broadcast

So when the operator opens these pages on the demo account, every surface has real data.

---

## 12. Execution order

Three workers, two phases:

**Phase 1 (sequential):**
1. **Segments worker** — migration, lib/marketing/segments*, segments API + UI, tests. Lands `customer_segments` table + auto-segment seeds. Other workers can then reference `segment_id`.

**Phase 2 (parallel after Segments lands):**
2. **Coupons worker** — coupons + coupon_redemptions tables (additive migration), API, UI, tests, POS stub field.
3. **Broadcasts worker** — broadcasts + broadcast_recipients tables, API, UI, tests, Resend integration, CTC gen.

Each worker owns its end-to-end loop including its own tests and demo seed contributions. Spec lock prevents schema drift between the parallel pair.

---

## 13. Estimated impact

- ~1 migration file (~250 SQL lines)
- ~10 lib files
- ~10 API route files
- ~10 page files + ~6 component files
- ~9 test files
- ~30 files modified or created total
- No changes to existing M1–M6 code paths. Pure additive.
