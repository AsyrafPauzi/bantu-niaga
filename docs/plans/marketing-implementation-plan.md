# Marketing Pillar — Implementation Plan

> **Status:** Draft v1 · decisions locked (2026-06-12)
> **Owner:** Asyraf (Marketing + Sales + HR)
> **Companion docs:** [`marketing-decisions.md`](./marketing-decisions.md) (the 12 blocking questions are closed there — read it first), `sales-implementation-plan.md`, `hr-implementation-plan.md`.
> **Cross-pillar coupling:** Marketing **owns the Customer entity**. Finance / Operations / Sales all reference it by foreign key and emit events that Marketing consumes to keep purchase metrics fresh.

> ⚠️ **Where this plan and `marketing-decisions.md` disagree, the decisions doc wins.** Specifically: §12 open questions are all closed there; the M1 schema also includes `customer_external_refs` (Q5) and `customers.deleted_at` (Q8); `DELETE /customers/[id]` is soft-delete (overrides §12.3); the Sales POS reads/writes go through `/api/sales/pos/*` (Q11), not direct Marketing endpoints. Update this plan inline next time it's edited; until then, treat the decisions doc as authoritative.

This plan is the executable spec for the Marketing pillar's v1 Base Package. It nails down the data model, the cross-pillar event contracts, the API surface, the UI surfaces, and the milestone sequencing so two developers can ship Marketing + (Sales, HR) and (Admin, Finance, Operations) in parallel without colliding.

It assumes Phase 0 (RBAC matrix + RLS helpers + Supabase Auth + `events_outbox` dispatcher) is landed or in flight. References in this doc are to canonical specs — do not re-litigate them here.

---

## 1. Goals & Non-Goals

### 1.1 Goals

This plan delivers the v1 Base Package for Marketing as locked in [`docs/v1-core-scope.md` §Pillar 4](../v1-core-scope.md) and detailed in [`docs/pillars/04-marketing.md` §2](../pillars/04-marketing.md):

1. **Customer Profiles CRM** as the canonical Customer entity for the whole system — owned by Marketing, referenced by Finance (invoices), Operations (orders, bookings), and Sales (POS, leads).
2. **Derived purchase metrics** — `total_spend_myr`, `last_purchase_at`, `order_count`, `aov_myr` — kept fresh in real time by an async consumer of `invoice.paid` / `order.delivered` / `booking.completed`.
3. **Phone-based dedup** — normalized E.164 (Malaysia default `+60`), auto-merge on exact match, "looks-like-the-same-customer" prompt on phone-match-with-name-mismatch, no-merge when no phone is provided.
4. **Auto-segmentation tags** — `new`, `repeat`, `vip`, `dormant`, `at-risk` — computed nightly by a Supabase Edge Function from CRM fields and emitted as `customer.tag_changed` events for downstream consumers (Promo Engine add-on, future WA Broadcast).
5. **Customer CSV Import + Export** — two-phase commit (upload → dry-run preview → confirm) for import, single-file CSV mirror with auto-tags for export.
6. **Social Media Content Calendar** for TikTok / IG / FB (plan-only, no auto-post).
7. **Three RBAC-enforced surfaces** (`/marketing`, `/marketing/customers`, `/marketing/content`) wired into the existing permissions matrix and pillar registry.

### 1.2 Non-Goals (Out of scope for this plan)

- All Marketing add-ons: **Smart Link Tracker (UTM)**, **Promo Engine & WA Script Templates**, future **WA Broadcast Manager**, **Loyalty Stamps**, **Reviews Collector**, **Birthday Auto-Greet**. Listed in [`docs/pillars/04-marketing.md` §3](../pillars/04-marketing.md) and `docs/marketplace-addons.md`.
- Auto-posting to social platforms (TikTok / IG / FB Graph API integrations).
- The merge audit UI for desktop CRM is sketched but the **merge-conflict-resolution workflow** in v1 surfaces a simple modal on the Customer detail page; a full merge inbox is post-v1.
- Multi-channel attribution beyond the `source` enum on `customers` (full UTM attribution lives in the Smart Link Tracker add-on).
- Per-business overridable segmentation thresholds — **flagged as Open Question 12.1**. Default plan ships hard-coded thresholds.
- Customer-facing data (e.g. self-service profile editing) — out of scope; customers do not log in.
- Reimagining the events_outbox dispatcher — this plan **consumes** the dispatcher Phase 0 ships; it does not redesign it.

---

## 2. Data Model

All Marketing-owned tables sit in the existing `public` schema, carry `business_id uuid not null references public.businesses(id)`, and have RLS enabled with policies that filter on `business_id = public.current_business_id()`. The helper function already exists in [`supabase/migrations/00000000000000_init.sql`](../../supabase/migrations/00000000000000_init.sql).

### 2.1 Table inventory (Marketing-owned)

| Table | Purpose | RLS scope |
|-------|---------|-----------|
| `customers` | Canonical customer record. Foreign-keyed by Finance / Operations / Sales. | `business_id` |
| `customer_tag_history` | Append-only ledger of auto-tag transitions (drives idempotency for `customer.tag_changed`). | `business_id` |
| `customer_csv_imports` | Tracks in-flight CSV imports (two-phase commit state). | `business_id` |
| `content_plan` | Social calendar entries (TikTok / IG / FB). | `business_id` |
| `content_plan_media` | Junction: `content_plan_id ↔ admin storage file id`. | `business_id` |

Marketing does **not** own a separate `customer_notes[]` table in v1 — notes ship as a `notes text` field on `customers`. A normalized notes timeline is post-v1 (see §12.2).

### 2.2 `customers`

```sql
create table public.customers (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references public.businesses(id) on delete cascade,

  -- contact
  name                text not null,
  phone_e164          text,                          -- normalized E.164, null allowed
  email               text,
  address             text,

  -- segmentation tag arrays (see §2.5 for the "why both columns" rationale)
  manual_tags         text[] not null default '{}',  -- user-controlled
  auto_tags           text[] not null default '{}',  -- system-controlled (nightly refresh)

  notes               text,                          -- free-form, single field in v1

  -- derived purchase metrics (real-time from invoice/order/booking events)
  total_spend_myr     numeric(12, 2) not null default 0,
  last_purchase_at    timestamptz,
  order_count         integer not null default 0,
  aov_myr             numeric(12, 2) generated always as (
    case when order_count > 0 then total_spend_myr / order_count else 0 end
  ) stored,

  -- provenance
  source              text not null default 'manual'
                      check (source in ('pos', 'booking', 'lead_conversion', 'csv_import', 'manual', 'public_booking_page')),
  created_by_user_id  uuid references public.users(id) on delete set null,
  merged_into_id      uuid references public.customers(id) on delete set null,  -- soft-merge marker

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Phone uniqueness is per-business and only enforced on non-null normalized phones.
create unique index customers_business_phone_unique
  on public.customers (business_id, phone_e164)
  where phone_e164 is not null and merged_into_id is null;

-- List + filter indexes
create index customers_business_idx              on public.customers (business_id);
create index customers_business_last_purchase_idx
  on public.customers (business_id, last_purchase_at desc nulls last);
create index customers_business_name_trgm_idx
  on public.customers using gin (lower(name) gin_trgm_ops);   -- requires pg_trgm
create index customers_auto_tags_idx             on public.customers using gin (auto_tags);
create index customers_manual_tags_idx           on public.customers using gin (manual_tags);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "customers_select_self_business" on public.customers
  for select using (business_id = public.current_business_id());

create policy "customers_insert_self_business" on public.customers
  for insert with check (business_id = public.current_business_id());

create policy "customers_update_self_business" on public.customers
  for update using (business_id = public.current_business_id())
              with check (business_id = public.current_business_id());

create policy "customers_delete_self_business" on public.customers
  for delete using (business_id = public.current_business_id());
```

> **Note on `pg_trgm`:** v1 CRM search uses trigram-based ILIKE on name (~1k–5k customers per business). If the extension is not yet enabled in the Phase 0 baseline, the Marketing migration enables it (`create extension if not exists pg_trgm`).

### 2.3 `customer_tag_history`

Append-only log of auto-tag transitions. Provides:
- Idempotency: the nightly Edge Function consults the latest row per customer before emitting `customer.tag_changed`.
- Audit trail without bloating `audit_log` with one row per customer per night.

```sql
create table public.customer_tag_history (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  prior_auto_tags text[] not null,
  new_auto_tags   text[] not null,
  computed_at     timestamptz not null default now(),
  run_id          uuid                              -- batch id for the nightly Edge Function run
);

create index customer_tag_history_customer_idx
  on public.customer_tag_history (customer_id, computed_at desc);

alter table public.customer_tag_history enable row level security;

create policy "customer_tag_history_select_self_business" on public.customer_tag_history
  for select using (business_id = public.current_business_id());

-- Inserts are done by the Edge Function via service_role; no public insert policy.
```

### 2.4 `customer_csv_imports`

```sql
create table public.customer_csv_imports (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  uploaded_by     uuid references public.users(id) on delete set null,
  storage_path    text not null,                    -- Supabase Storage object key
  original_name   text not null,
  row_count       integer,                          -- populated after dry-run
  preview         jsonb,                            -- {created:[], merged:[], rejected:[{row, reason}]}
  status          text not null default 'uploaded'
                  check (status in ('uploaded', 'previewed', 'committed', 'failed', 'expired')),
  committed_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  created_at      timestamptz not null default now()
);

create index customer_csv_imports_business_idx
  on public.customer_csv_imports (business_id, created_at desc);

alter table public.customer_csv_imports enable row level security;

create policy "csv_imports_self_business" on public.customer_csv_imports
  for all using (business_id = public.current_business_id())
          with check (business_id = public.current_business_id());
```

### 2.5 `content_plan` & `content_plan_media`

```sql
create table public.content_plan (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  channel       text not null check (channel in ('tiktok', 'instagram', 'facebook')),
  status        text not null default 'idea'
                check (status in ('idea', 'drafted', 'scheduled', 'posted')),
  scheduled_at  timestamptz,
  hook          text,
  caption       text,
  created_by    uuid references public.users(id) on delete set null,
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index content_plan_business_scheduled_idx
  on public.content_plan (business_id, scheduled_at);

create trigger content_plan_set_updated_at
  before update on public.content_plan
  for each row execute function public.set_updated_at();

alter table public.content_plan enable row level security;

create policy "content_plan_self_business" on public.content_plan
  for all using (business_id = public.current_business_id())
          with check (business_id = public.current_business_id());

-- Junction table: content_plan ↔ admin storage files (many-to-many in practice;
-- Carousel posts on IG can attach multiple media).
create table public.content_plan_media (
  content_plan_id uuid not null references public.content_plan(id) on delete cascade,
  file_id         uuid not null,                    -- FK to admin storage files table (other dev)
  business_id     uuid not null references public.businesses(id) on delete cascade,
  position        smallint not null default 0,
  primary key (content_plan_id, file_id)
);

create index content_plan_media_business_idx
  on public.content_plan_media (business_id);

alter table public.content_plan_media enable row level security;
create policy "content_plan_media_self_business" on public.content_plan_media
  for all using (business_id = public.current_business_id())
          with check (business_id = public.current_business_id());
```

> **Cross-pillar contract A — Admin Storage file id:** the other dev (Admin) must publish the canonical `files` (or `storage_files`) table name + id column type. Until then, `file_id uuid` is the placeholder. If the Admin table is `public.files (id uuid …)`, add `references public.files(id) on delete restrict` in a follow-up migration. **Tracked in §3.3 — blocked-on item.**

### 2.6 Decision: where do auto-tags live?

**Both** denormalized array column (`customers.auto_tags`) **and** a transition ledger (`customer_tag_history`). Justification:

| Storage choice | Rationale |
|----------------|-----------|
| Array column on `customers` | (1) Fast list filtering (`auto_tags @> '{vip}'` with GIN index). (2) Single-row read returns the full customer card. (3) Idiomatic for downstream listeners (Promo Engine targeting reads one column). |
| Separate `customer_tag_history` row per transition | (1) Idempotency key for `customer.tag_changed` emission: only emit when `prior_auto_tags != new_auto_tags`. (2) Cheap audit trail without exploding `audit_log` to one row per customer per night. (3) Lets the future Marketing AI agent reason over "this customer drifted from `repeat` to `dormant` 14 days ago". |

A separate normalized `customer_tags` lookup table was rejected: it triples query complexity for a fixed enum of 5 system tags + unbounded user tags. The two-column array model is simpler and gives manual vs auto separation for free.

---

## 3. Cross-Pillar Contracts (most important section)

Marketing's job in the system is to be the **single source of truth for the Customer entity**. Every other pillar emits events that mutate customer state, and Marketing emits events that other pillars react to. This section is the canonical contract — once accepted, both developers implement against it.

> **Reading the tables:** "Sync" means the listener runs inside the source pillar's transaction (rollback together). "Async" means the listener runs from the `events_outbox` dispatcher (at-least-once delivery, must be idempotent). See [`docs/architecture/cross-pillar-sync.md` §5](../architecture/cross-pillar-sync.md).

### 3.1 Events Marketing emits

These events get appended to the `EventName` union in `lib/events/types.ts`. Names marked **(new)** do not exist yet.

#### 3.1.1 `customer.created` (already declared)

- **When it fires:** every time a new row lands in `customers`, regardless of source (POS ring-up, lead conversion, public booking, CSV import row, manual add).
- **Payload:** existing `CustomerCreatedPayload` in `lib/events/types.ts` is correct.
  ```ts
  interface CustomerCreatedPayload {
    customer_id: string;
    phone_e164: string | null;
    name: string;
    source: "pos" | "booking" | "lead_conversion" | "csv_import" | "manual";
  }
  ```
  > **Extension needed:** add `"public_booking_page"` to the `source` union to match the `customers.source` check constraint. Single-line additive change.
- **Listeners:**
  | Listener | Sync? | Effect |
  |----------|-------|--------|
  | Marketing (self) | sync | No-op — emission is the side-effect of the insert. |
  | Admin notification feed | async | "New customer: {name}" entry. |
  | Future: WA Broadcast Manager | async | Subscribe-on-creation hook (post-v1). |

#### 3.1.2 `customer.merged` **(new)**

- **When it fires:** when phone dedup auto-merges a freshly-created customer into an existing record (the new row is discarded; its surviving `id` is the existing one). Also fires when the owner confirms a manual merge from the "looks like the same customer" prompt.
- **Payload:**
  ```ts
  interface CustomerMergedPayload {
    surviving_customer_id: string;
    discarded_customer_id: string;
    matched_on: "phone_exact" | "manual_prompt";
    actor_user_id: string | null;       // null when the merge happens server-side from an auto-flow
    merged_at: string;                  // ISO timestamp
  }
  ```
- **Listeners:**
  | Listener | Sync? | Effect |
  |----------|-------|--------|
  | Sales | async | Re-point any `leads.converted_customer_id = discarded_customer_id` rows to `surviving_customer_id`. |
  | Operations | async | Re-point `orders.customer_id` and `bookings.customer_id` for the discarded id. |
  | Finance | async | Re-point `invoices.customer_id` (if Finance materialises customer FK on invoices — see §3.3 contract). |
  | Admin notification feed | async | "Merged 2 customer records: kept {name}." |

> The `discarded_customer_id` row stays in the database with `merged_into_id = surviving_customer_id`. We never hard-delete customers because Finance/Operations FKs would orphan. The unique-phone partial index excludes merged rows, so re-importing the same phone won't conflict with a tombstone.

#### 3.1.3 `customer.tag_changed` **(new)**

- **When it fires:** exclusively from the nightly auto-segmentation Edge Function (§6), and only for customers whose computed `auto_tags` differ from their stored `auto_tags`. **Never fires for manual tag changes** (those are silent — they're user-driven and don't need cross-pillar fanout in v1).
- **Payload:**
  ```ts
  interface CustomerTagChangedPayload {
    customer_id: string;
    prior_auto_tags: string[];          // e.g. ["repeat"]
    new_auto_tags: string[];            // e.g. ["repeat", "at-risk"]
    added: string[];                    // ["at-risk"]
    removed: string[];                  // []
    computed_at: string;                // ISO timestamp
    run_id: string;                     // batch id of the nightly run
  }
  ```
- **Listeners:**
  | Listener | Sync? | Effect |
  |----------|-------|--------|
  | Future Promo Engine add-on | async | Trigger drip campaigns on `added.includes('at-risk')`. |
  | Future WA Broadcast Manager | async | Auto-include in segment audiences. |
  | Marketing AI agent (future) | async | Feed into morning brief: "5 customers slipped to dormant." |

> In v1 base, no pillar consumes `customer.tag_changed` for hard behaviour — it's emitted purely so add-ons and Pillar AI can subscribe without re-running the segmentation logic. This is deliberate: the contract is shipped early so add-on devs can build against it.

#### 3.1.4 `customer.updated` **(new, internal)**

- **When it fires:** when CRM fields (name, email, address, manual_tags, notes) are edited via the desktop CRM. Excludes derived-field churn (purchase metrics). Excludes auto_tags changes (covered by `customer.tag_changed`).
- **Payload:**
  ```ts
  interface CustomerUpdatedPayload {
    customer_id: string;
    changed_fields: Array<"name" | "email" | "address" | "manual_tags" | "notes" | "phone_e164">;
    actor_user_id: string | null;
  }
  ```
- **Listeners:** Admin audit feed (async). No business listener in v1.
- **Why ship it now?** Cheap to emit and gives the AI agent a clean stream later. Removing it post-v1 would force a schema migration on listeners.

### 3.2 Events Marketing consumes

Every consumer is **async** (lives in `events_outbox` dispatcher), and **idempotent** keyed on the event row id (`events_outbox.id`). The handler short-circuits if it has already processed that event id — track processed ids in a small `customer_metric_ledger` table OR inside the `audit_log` if the dispatcher already does dedup by event_id. The plan assumes **the dispatcher exposes the originating `events_outbox.id`** to handlers; if not, Marketing adds a per-handler `marketing_event_dedup (event_id primary key, processed_at)` table.

#### 3.2.1 `invoice.paid` — update purchase metrics

- **Source pillar:** Finance / Sales (emitter is whoever marks the invoice paid).
- **Payload contract (existing in `lib/events/types.ts`):**
  ```ts
  interface InvoicePaidPayload {
    invoice_id: string;
    invoice_number: string;
    total_myr: number;
    payment_method: "cash" | "duitnow_qr" | "duitnow_transfer" | "gateway";
    paid_at: string;
    line_items: Array<{
      product_id: string | null;
      qty: number;
      unit_price_myr: number;
      subtotal_myr: number;
    }>;
  }
  ```
  > **Required addition by the other dev:** add `customer_id: string | null` to this payload. Without it Marketing cannot route the metric update. **Tracked in §3.3 — blocked-on item.**
- **Marketing effect:** within the listener, if `customer_id` non-null:
  ```sql
  update customers
     set total_spend_myr  = total_spend_myr + payload.total_myr,
         order_count      = order_count + 1,
         last_purchase_at = greatest(coalesce(last_purchase_at, payload.paid_at), payload.paid_at)
   where id = payload.customer_id and business_id = event.business_id;
  ```
  AOV is generated; nothing to update. If the listener has already processed this event id, skip the update.
- **Idempotency key:** `events_outbox.id` of the originating event. Stored in `marketing_event_dedup` (or whatever dispatcher-level dedup table Phase 0 provides). Marketing must never double-count.
- **Failure mode:** if `customer_id` non-null but row not found in `customers` (data drift), log to `audit_log` and skip; do not retry forever.

#### 3.2.2 `order.delivered` — update purchase metrics

- **Source pillar:** Operations.
- **Payload contract — proposed (does not yet exist):**
  ```ts
  interface OrderDeliveredPayload {
    order_id: string;
    customer_id: string | null;
    invoice_id: string | null;          // if Finance has been involved
    line_items: Array<{
      product_id: string | null;
      qty: number;
      unit_price_myr: number;
      subtotal_myr: number;
    }>;
    total_myr: number;
    delivered_at: string;
  }
  ```
- **Marketing effect:**
  - If `invoice_id` is non-null AND the invoice has already produced an `invoice.paid` event Marketing processed, **skip** to avoid double-counting (`order.delivered` typically fires before the invoice is paid). Track via `invoice_id` look-aside.
  - If `invoice_id` is null (cash-on-delivery, no invoice), update metrics from the order payload.
- **Idempotency key:** `events_outbox.id`.

#### 3.2.3 `booking.completed` — update purchase metrics

- **Source pillar:** Operations.
- **Payload contract — proposed:**
  ```ts
  interface BookingCompletedPayload {
    booking_id: string;
    customer_id: string | null;
    invoice_id: string | null;
    service_total_myr: number;
    completed_at: string;
  }
  ```
- **Marketing effect:** identical pattern to `order.delivered` — only count once. Treat the invoice as authoritative when present.
- **Idempotency key:** `events_outbox.id`.

#### 3.2.4 `lead.converted` — create or merge customer

- **Source pillar:** Sales.
- **Payload contract — proposed:**
  ```ts
  interface LeadConvertedPayload {
    lead_id: string;
    name: string;
    phone_e164: string | null;
    email: string | null;
    note: string | null;                // any free-text note from the lead card
    converted_at: string;
  }
  ```
- **Marketing effect:** run the dedup helper (§7). Result:
  - `new` → insert a fresh `customers` row with `source = 'lead_conversion'`; emit `customer.created`.
  - `merge` → no insert; emit `customer.merged` (matched_on `phone_exact`); return surviving id.
  - `prompt` → insert a fresh row anyway, but flag `merged_into_id = null` and write a `pending_merge` task to Admin Notification Feed (the owner resolves the merge from the desktop CRM — see §7.4).
  - Sales gets the surviving `customer_id` back via the event handler's return value? **No — the event bus is one-way.** Instead, Sales reads the customer_id from `customers.lead_id` (Sales' choice) or queries by lead_id. Cleanest contract: Sales writes the new `leads.converted_customer_id` itself by calling a Marketing API endpoint as part of its convert flow (synchronous). The `lead.converted` event becomes purely informational. **Tracked in §3.3.**
- **Idempotency key:** `events_outbox.id` + `lead_id`.

#### 3.2.5 POS sale (intermediate) — `customer.created` is the contract

- The Sales pillar already emits `customer.created` from `POS` when a cashier attaches a phone-based customer to a sale at checkout. Marketing does **not** need a separate event from POS: dedup runs inside Marketing's own `customer.created` listener (the listener that handles the row insertion before the event is dispatched).
- **Flow:** Sales POS calls Marketing's `POST /api/marketing/customers` with `{phone, name, source: 'pos'}`. Marketing returns either the newly-created customer or the surviving merge target. Sales then writes `sales.customer_id` to the resulting id. The `customer.created` event is emitted from Marketing's own POST handler inside the same transaction (via outbox).
- The `customer.created` payload's `source` field already supports `"pos"`.

#### 3.2.6 `booking.confirmed` — optional customer activity log

- **Source pillar:** Operations.
- **Marketing effect (v1):** none. We do not update purchase metrics on `booking.confirmed` because the booking might still cancel. Wait for `booking.completed`. The cross-pillar map in [`cross-pillar-sync.md` §3](../architecture/cross-pillar-sync.md) mentions "customer activity logged" — in v1 base this is a no-op; post-v1 the future Marketing AI agent will log activity timeline entries.
- Documented here so Operations dev knows we **explicitly do nothing** on this event in v1 (no contract debt).

### 3.3 Blocked-on (other dev's deliverables before Marketing can fully ship)

These are the cross-pillar dependencies Marketing cannot finish without. They are framed as contracts so the other dev has a clear interface to ship to.

| # | Contract | Owner | Description | Marketing's interim stub |
|---|----------|-------|-------------|--------------------------|
| **D1** | `customer_id` on `invoices` | Finance | Add `customer_id uuid references public.customers(id)` to the `invoices` table migration. Without it, `invoice.paid` cannot route to a customer row. | Marketing skips metric update if payload `customer_id` is missing. |
| **D2** | `customer_id` on `InvoicePaidPayload` | Finance | Add `customer_id: string \| null` to the existing `InvoicePaidPayload` TS interface in `lib/events/types.ts`. | Stub field on Marketing's listener; defensive null-check. |
| **D3** | `OrderDeliveredPayload` schema | Operations | Define the payload exactly as proposed in §3.2.2. | Marketing emits a TODO; listener is a no-op until payload lands. |
| **D4** | `BookingCompletedPayload` schema | Operations | Define the payload exactly as proposed in §3.2.3. | Same as D3. |
| **D5** | `LeadConvertedPayload` schema + the convert API call to Marketing | Sales (Asyraf himself) | Sales POSTs `/api/marketing/customers` from the convert-to-customer flow, then sets `leads.converted_customer_id` to the returned id, then emits `lead.converted`. | This is Asyraf's own dependency — sequence within his work; not blocking. |
| **D6** | Admin Storage `files` table id type | Admin (other dev) | Confirm the canonical table name (likely `public.files`) and `id` column type (likely `uuid`). | Marketing's `content_plan_media.file_id` is `uuid` without a FK; FK added in a follow-up migration. |
| **D7** | Admin notification feed insert API | Admin (other dev) | Expose a server-side helper `lib/notifications/post.ts` with signature `postToFeed(business_id, type, message, meta)`. Marketing calls it from `customer.merged` and `customer.created` async listeners. | Until ready: Marketing inserts directly into a `notifications` table once Admin defines it; OR Marketing's handler is a no-op (no notification posted; logged only). |
| **D8** | Events dispatcher exposes `event.id` to handlers + dedup table | Admin (other dev) — owner of Phase 0 dispatcher | Handlers must receive the originating `events_outbox.id` so each can dedupe. If dispatcher doesn't dedupe globally, Marketing maintains its own `marketing_event_dedup` table. | Marketing ships with the per-pillar dedup table. Remove if dispatcher provides global dedup. |
| **D9** | `pg_trgm` extension enabled | Admin (Phase 0) | Enable in the baseline migration if it isn't already. | Marketing's CRM-search migration adds `create extension if not exists pg_trgm`. Idempotent. |

Items D1–D2, D3, D4, D7 are the only ones that **block end-to-end real-time purchase-metric updates**. Marketing can ship M1–M3 + M5 (UI surfaces, CSV, content calendar) without any of them. M4 + M6 need them.

---

## 4. API Surface

All routes live under `app/api/marketing/*`. Every route:

- Validates body / query with **Zod** (Zod 3 is already a dependency).
- Resolves the caller via `getCurrentUser()` (`lib/auth/current-user.ts`).
- Calls `canSurface(role, 'marketing', <surface>)` from `lib/permissions.ts` and returns `403` on deny.
- Relies on Postgres RLS as defense-in-depth — every Marketing table is `business_id`-scoped via `public.current_business_id()`.
- Mutations that need cross-pillar fanout write to `events_outbox` **inside the same transaction** that mutates the entity (transactional outbox pattern, see [`cross-pillar-sync.md` §5](../architecture/cross-pillar-sync.md)).

### 4.1 Route inventory

| Method | Path | Surface | Roles (matrix) | Mutates outbox? |
|--------|------|---------|----------------|-----------------|
| `GET`  | `/api/marketing/customers` | `customers` | owner, manager | no |
| `POST` | `/api/marketing/customers` | `customers` | owner, manager (and **cashier** — see §9.1) | **yes** — `customer.created` |
| `GET`  | `/api/marketing/customers/[id]` | `customers` | owner, manager | no |
| `PATCH`| `/api/marketing/customers/[id]` | `customers` | owner, manager | **yes** — `customer.updated` |
| `DELETE`| `/api/marketing/customers/[id]` | `customers` | owner, manager | no — hard delete forbidden; this endpoint sets `merged_into_id = null`-tombstone or returns 405 in v1 |
| `POST` | `/api/marketing/customers/[id]/merge` | `customers` | owner, manager | **yes** — `customer.merged` |
| `GET`  | `/api/marketing/customers/search` | `customers` | owner, manager | no |
| `POST` | `/api/marketing/customers/csv-import` | `csv_import` | owner, manager | no (upload only) |
| `POST` | `/api/marketing/customers/csv-import/[id]/preview` | `csv_import` | owner, manager | no |
| `POST` | `/api/marketing/customers/csv-import/[id]/commit` | `csv_import` | owner, manager | **yes** — many `customer.created` (one per inserted row) |
| `GET`  | `/api/marketing/customers/csv-export` | `csv_import` | owner, manager | no |
| `GET`  | `/api/marketing/content` | `content` | owner, manager | no |
| `POST` | `/api/marketing/content` | `content` | owner, manager | no |
| `PATCH`| `/api/marketing/content/[id]` | `content` | owner, manager | no |
| `DELETE`| `/api/marketing/content/[id]` | `content` | owner, manager | no |

> **DELETE customer:** intentionally tight in v1 — owners use the merge prompt to consolidate duplicates. Hard delete is rejected because it would orphan Finance / Operations / Sales FKs. A "Delete this customer (irreversible)" admin action lives post-v1.

### 4.2 Schemas

All schemas are Zod definitions kept in `lib/marketing/schemas.ts` (planned, not yet written) and re-exported into route handlers.

#### 4.2.1 `POST /api/marketing/customers`

Request body (`CustomerCreateInput`):
```ts
const CustomerCreateInput = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().optional(),         // raw input; server normalizes to E.164
  email: z.string().email().optional(),
  address: z.string().trim().max(500).optional(),
  manual_tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(["pos", "booking", "lead_conversion", "csv_import", "manual", "public_booking_page"])
           .default("manual"),
});
```

Response (`CustomerCreateResult`):
```ts
type CustomerCreateResult =
  | { action: "created";  customer: Customer; }
  | { action: "merged";   customer: Customer; merged_into_id: string; }
  | { action: "prompt";   customer: Customer; potential_match: { id: string; name: string; phone_e164: string; }; };
```

Server flow:
1. Normalize `phone` to E.164 (§7.1).
2. Run dedup helper (§7.2). Returns one of:
   - `new` → insert + `customer.created` outbox row, return `action: "created"`.
   - `merge` → no insert; return `action: "merged"` with the surviving customer + `customer.merged` outbox row.
   - `prompt` → insert anyway as new row, return `action: "prompt"` so the UI can surface the merge confirmation.
3. All three return the canonical `Customer` shape.

#### 4.2.2 `GET /api/marketing/customers`

Query:
```ts
const CustomerListQuery = z.object({
  q: z.string().trim().optional(),              // name / phone / email substring
  tag: z.string().optional(),                   // single tag filter; repeatable
  auto_tag: z.enum(["new", "repeat", "vip", "dormant", "at-risk"]).optional(),
  sort: z.enum(["recent", "name", "spend"]).default("recent"),
  cursor: z.string().optional(),                // opaque cursor (id + last_purchase_at)
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

Response:
```ts
{
  items: CustomerListRow[],            // lean shape; not full Customer
  next_cursor: string | null,
}
```

`CustomerListRow`: `{ id, name, phone_e164, auto_tags, manual_tags, total_spend_myr, last_purchase_at, order_count }`.

#### 4.2.3 `GET /api/marketing/customers/search`

Lightweight search endpoint optimized for typeahead from POS / leads / bookings (called from the Sales POS "+ Customer" autocomplete and the Operations "attach customer to booking" picker).

```ts
const CustomerSearchQuery = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
```

Response:
```ts
{ items: Array<{ id: string; name: string; phone_e164: string | null; }> }
```

#### 4.2.4 `PATCH /api/marketing/customers/[id]`

Same shape as create but every field optional. Server diffs changed fields and emits `customer.updated` with the `changed_fields` array.

#### 4.2.5 `POST /api/marketing/customers/[id]/merge`

```ts
const MergeInput = z.object({
  discarded_customer_id: z.string().uuid(),
});
```

Server: sets `discarded.merged_into_id = surviving.id`, copies non-conflicting fields (e.g. surviving inherits the longer notes string, the union of manual_tags), re-points orders/bookings/invoices/leads in a single transaction, emits `customer.merged`.

> **Note:** in v1 the re-pointing of foreign tables is done **by the merge endpoint itself**, not by the other pillars' async handlers. This keeps the merge transactional. The async `customer.merged` listeners are only for notifications + audit. This decision keeps the merge UX honest: when the modal closes the customer is fully merged.

#### 4.2.6 CSV import endpoints

**`POST /api/marketing/customers/csv-import`** — multipart upload.
- Max file: **5 MB**, max rows after parse: **5,000**.
- Stores in Supabase Storage at `csv-imports/{business_id}/{import_id}.csv` (private bucket).
- Inserts a `customer_csv_imports` row with `status='uploaded'`.
- Returns `{ import_id }`.

**`POST /api/marketing/customers/csv-import/[id]/preview`** — dry-run.
- Reads the file, parses, normalizes phones, runs dedup on each row.
- Writes `preview = { created:[…], merged:[…], rejected:[{row_number, reason}] }` to the row.
- Sets `status='previewed'`.
- Returns the full preview payload.

**`POST /api/marketing/customers/csv-import/[id]/commit`** — atomic apply.
- Re-checks `status='previewed'` and `expires_at > now()`. Rejects otherwise.
- Within a single transaction, inserts every `created` row + emits one `customer.created` outbox row per insertion. `merged` rows are no-ops (the existing customer already covers them — they're informational only, the import doesn't change existing rows in v1).
- Sets `status='committed'` + `committed_at = now()`.
- Returns summary counts.

**`GET /api/marketing/customers/csv-export`** — streaming CSV response.
- Output columns: `name,phone,email,address,manual_tags,auto_tags,total_spend_myr,order_count,last_purchase_at,notes,created_at`.
- `manual_tags` / `auto_tags` serialized as `tag1|tag2|tag3`.
- 200 OK, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="customers-{idcompany}-{YYYY-MM-DD}.csv"`.

#### 4.2.7 Content calendar endpoints

```ts
const ContentEntryInput = z.object({
  channel: z.enum(["tiktok", "instagram", "facebook"]),
  status: z.enum(["idea", "drafted", "scheduled", "posted"]).default("idea"),
  scheduled_at: z.string().datetime().optional(),
  hook: z.string().trim().max(280).optional(),
  caption: z.string().trim().max(4000).optional(),
  media_file_ids: z.array(z.string().uuid()).max(10).default([]),
});

const ContentListQuery = z.object({
  from: z.string().datetime().optional(),       // inclusive
  to: z.string().datetime().optional(),         // exclusive
  channel: z.enum(["tiktok", "instagram", "facebook"]).optional(),
  status: z.enum(["idea", "drafted", "scheduled", "posted"]).optional(),
});
```

`POST /api/marketing/content` inserts into `content_plan` + replaces `content_plan_media` rows. No outbox event in v1 (content calendar is not consumed by other pillars).

### 4.3 Mutations that write to `events_outbox`

Concise list:
- `POST /api/marketing/customers` — appends one `customer.created` (and optionally `customer.merged` if the dedup auto-merges).
- `POST /api/marketing/customers/[id]/merge` — appends one `customer.merged`.
- `PATCH /api/marketing/customers/[id]` — appends one `customer.updated` (only if `changed_fields.length > 0`).
- `POST /api/marketing/customers/csv-import/[id]/commit` — appends N `customer.created` events (one per inserted row) in the same transaction.

All other Marketing routes are pure reads or do not need cross-pillar fanout.

---

## 5. UI Surfaces

Each route lives under `app/(app)/marketing/*`. The shell layouts in `app/(app)/layout.tsx` already differentiate mobile vs desktop based on the `useMode()` hook in `lib/use-mode.ts`. Marketing components follow the same pattern.

### 5.1 Route inventory

| Path | Primary mode | Purpose |
|------|--------------|---------|
| `/marketing` | both | Pillar landing: KPI cards (total customers, new this month, VIP count, dormant count), 3 quick actions. |
| `/marketing/customers` | both | Customer list with search + filters. |
| `/marketing/customers/[id]` | desktop primary; mobile summary fallback | Full customer profile + merge prompts + edit. |
| `/marketing/customers/new` | both | Manual add customer form. |
| `/marketing/customers/import` | **desktop** | CSV upload + dry-run preview table + confirm. |
| `/marketing/content` | desktop | Calendar view (day / week / month) + entry editor. |
| `/marketing/content/new` | both | New post entry form (mobile-friendly so owner can dump a TikTok idea on the move). |

> Mobile + desktop split discipline: the shell decides which layout component to render, but **pages don't branch ad-hoc** — see [`docs/architecture/dual-mode.md` §2 + §4](../architecture/dual-mode.md). The mobile customer detail is the same route as desktop, but rendered with a `<CustomerProfileMobile>` summary component on small viewports and a `<CustomerProfileDesktop>` full card on wide viewports. Both read the same data via the same server component.

### 5.2 Component inventory

Built on top of existing primitives in `components/ui/*` (`badge.tsx`, `button.tsx`, `card.tsx`). New components to add under `components/marketing/`:

- `<CustomerListTable>` — desktop dense table.
- `<CustomerListMobile>` — mobile vertical card list.
- `<CustomerListRow>` — shared row data shape.
- `<CustomerFilters>` — auto-tag chips + search box + sort.
- `<CustomerProfileDesktop>` — full card with sections (contact, purchase metrics, manual tags editor, auto-tags badges, notes, activity timeline placeholder).
- `<CustomerProfileMobile>` — summary card (name, phone, spend, last visit, top 3 tags); deep-link to desktop for full edit.
- `<MergePromptBanner>` — surfaces on customer detail when a dedup `prompt` outcome was recorded; "Merge with {other name}?" action.
- `<CustomerForm>` — used by `/new` and inline edit panels.
- `<TagBadge tag="vip" kind="auto" | "manual" />` — visually distinct (auto = solid, manual = outline, per the spec "auto-tags are visually distinct").
- `<CsvImportWizard>` — three steps: Upload → Preview (table with created/merged/rejected sections) → Confirm.
- `<ContentCalendar view="day" | "week" | "month">` — desktop calendar grid.
- `<ContentEntryEditor>` — drawer / modal form.
- `<ContentStatusBadge status="idea" | "drafted" | "scheduled" | "posted">`.

### 5.3 States per surface

For every list / form surface, plan the four states explicitly:

| Surface | Empty | Loading | Error | Populated |
|---------|-------|---------|-------|-----------|
| `/marketing/customers` (desktop) | Empty card "No customers yet. Add manually or import CSV." with two CTA buttons. | Skeleton rows (5). | Card with retry button + error code. | Table + pagination. |
| `/marketing/customers` (mobile) | Same empty card scaled. | Skeleton vertical cards. | Same error card. | Vertical list + infinite scroll. |
| `/marketing/customers/[id]` | n/a (404). | Skeleton card. | "Customer not found or you don't have access." | Profile. |
| `/marketing/customers/import` | "Upload a CSV (max 5 MB, 5,000 rows)." | Progress bar during upload, spinner during preview. | Inline rejection list with row numbers. | Preview table + "Confirm import (N customers)" button. |
| `/marketing/content` | "No posts planned. Add one." | Skeleton calendar cells. | Error card + retry. | Calendar grid populated with status-coloured entries. |

### 5.4 Existing scaffold gap

The current scaffolds in `app/(app)/marketing/*` are `PillarStub` components. The plan replaces them in milestones M2 (customers list/detail), M3 (CSV), M5 (content). The pillar landing page gets KPI cards in M6 once metrics are flowing.

---

## 6. Auto-Segmentation Logic

A nightly Supabase Edge Function recomputes auto-tags per customer and emits `customer.tag_changed` for movers only. Idempotent by construction: the function only emits when the new tag set differs from the stored one.

### 6.1 Trigger

- **Schedule:** daily at **02:30 Asia/Kuala_Lumpur** (UTC+8), which is **18:30 UTC** the previous day.
- **Cron syntax (Supabase Edge Function scheduled trigger / pg_cron):** `30 18 * * *`
- **Function name:** `supabase/functions/marketing-tag-refresh/index.ts` (to be created in M4; not part of this plan).

### 6.2 Inputs

Reads from `public.customers` for every business in batches of 500 rows. Reads `last_purchase_at`, `total_spend_myr`, `order_count`, current `auto_tags`. Reads no other tables.

### 6.3 Outputs

For each customer:
1. Compute the new auto_tag set from the rules in §6.4.
2. If `new_set != current_set`:
   - `update customers set auto_tags = new_set, updated_at = now() where id = ?`
   - Insert a `customer_tag_history` row with `prior_auto_tags`, `new_auto_tags`, `run_id`.
   - Insert a `customer.tag_changed` event into `events_outbox`.

All three writes per moved customer happen in a single statement-level transaction for atomicity.

### 6.4 Default thresholds (hard-coded in v1 unless §12.1 resolves otherwise)

```
new      ← first purchase < 30 days ago AND order_count <= 1
repeat   ← order_count >= 2
vip      ← total_spend_myr >= 1000 OR order_count >= 10
dormant  ← last_purchase_at IS NOT NULL AND last_purchase_at < (now() - 90 days)
at-risk  ← (was 'repeat' or 'vip') AND last_purchase_at < (now() - 60 days) AND last_purchase_at >= (now() - 90 days)
```

Notes:
- A customer can carry **multiple auto-tags** simultaneously (e.g. `repeat` + `at-risk`).
- The `at-risk` rule reads the **prior** tag set from `customer_tag_history` (or current `auto_tags` if no history exists) — a customer who was never `repeat` or `vip` cannot enter `at-risk`. This prevents a one-time buyer from being flagged "at-risk" the day they cross 60 days.
- `new` is mutually exclusive with `repeat` (the `order_count <= 1` AND-clause). The ordering matters: compute `new` last and remove `repeat` if `new` matches, OR compute in any order and let the AND-clause settle it.

### 6.5 Pseudo-code

```ts
// supabase/functions/marketing-tag-refresh/index.ts (PLANNED — do NOT implement here)
type Customer = {
  id: string; business_id: string;
  total_spend_myr: number; order_count: number;
  last_purchase_at: string | null;
  auto_tags: string[];
};

function computeAutoTags(c: Customer, priorTags: string[], now: Date): string[] {
  const next = new Set<string>();
  const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at) : null;
  const daysSince = lastPurchase
    ? (now.getTime() - lastPurchase.getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY;

  if (c.order_count >= 2)                                   next.add("repeat");
  if (c.total_spend_myr >= 1000 || c.order_count >= 10)     next.add("vip");
  if (lastPurchase && daysSince > 90)                       next.add("dormant");

  const wasEngaged = priorTags.includes("repeat") || priorTags.includes("vip");
  if (wasEngaged && daysSince > 60 && daysSince <= 90)      next.add("at-risk");

  if (lastPurchase && daysSince < 30 && c.order_count <= 1) next.add("new");

  return [...next].sort();
}

async function runOnce(runId: string) {
  let cursor: string | null = null;
  do {
    const batch = await selectCustomersPaged(cursor, 500);
    for (const c of batch) {
      const next = computeAutoTags(c, c.auto_tags, new Date());
      if (!arraysEqual(next, c.auto_tags)) {
        await applyTransition(c, next, runId);   // update + insert history + outbox event
      }
    }
    cursor = batch.at(-1)?.id ?? null;
  } while (cursor);
}
```

### 6.6 Failure modes

- Edge Function timeout (Supabase limit): batch processing already chunks; resumes via cursor on next run.
- Partial failure mid-batch: each customer's transition is its own transaction. The next run will re-converge.
- Backfill: a one-shot `marketing-tag-backfill` run can be triggered manually after M1 lands customers; it's the same code, just unconditional first-run.

---

## 7. Phone Dedup Logic

### 7.1 Normalization function

Pure helper in `lib/marketing/phone.ts` (planned, no code shipped here).

Behaviour:
- Input: any string the user typed (`'012-345 6789'`, `'+60123456789'`, `'60123456789'`, `'0123456789'`, etc.).
- Strip whitespace, hyphens, dots, parentheses.
- If starts with `+`, leave as-is and validate.
- If starts with `60`, prepend `+`.
- If starts with `0`, replace leading `0` with `+60`.
- If starts with a digit but not `60` and not `0`, reject (force user to confirm country).
- Validate against an E.164 regex: `^\+\d{8,15}$`. (Malaysian mobiles are `+601[0-9]{8,9}`, but other regions also exist for international customers.)
- Return `null` for empty / unparseable input. The caller decides whether `null` is acceptable (CSV import rejects null-phone rows; manual add allows null).

Tested against a fixture list of ~40 real-world Malaysian phone formats (see §10.1).

### 7.2 Match algorithm

In `lib/marketing/dedup.ts` (planned):

```ts
type DedupOutcome =
  | { action: "new" }
  | { action: "merge"; existingCustomerId: string; matched_on: "phone_exact" }
  | { action: "prompt"; existingCustomerId: string; existingName: string };

async function dedupOnCreate(
  businessId: string,
  input: { name: string; phoneE164: string | null }
): Promise<DedupOutcome> {
  if (!input.phoneE164) return { action: "new" };

  const existing = await db
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("phone_e164", input.phoneE164)
    .is("merged_into_id", null)
    .maybeSingle();

  if (!existing) return { action: "new" };

  const namesMatch = normalizeName(existing.name) === normalizeName(input.name);
  return namesMatch
    ? { action: "merge", existingCustomerId: existing.id, matched_on: "phone_exact" }
    : { action: "prompt", existingCustomerId: existing.id, existingName: existing.name };
}

function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
```

### 7.3 Where it runs

- **Always server-side.** Called from:
  - `POST /api/marketing/customers` (manual add, public booking page, lead conversion, POS attach-customer).
  - The CSV preview & commit endpoints (one call per CSV row).
  - The internal listener for `lead.converted` async event (defensive — Sales should have already called the API, but the async handler runs the dedup again as a safety net; idempotent because the lead.converted event id deduplicates).
- **Never client-side.** The mobile POS doesn't pre-check; it just posts and reads the action back.

### 7.4 Conflict resolution UI

When `POST /api/marketing/customers` returns `action: "prompt"`:
- A new row is inserted (so the source flow — POS sale, lead conversion, public booking — can complete and reference *some* customer_id).
- The response carries `potential_match: { id, name, phone_e164 }`.
- The mobile POS shows a tiny non-blocking toast: "Phone matches existing customer {name}. Review in CRM." Then completes the sale.
- The desktop CRM's customer detail page (`/marketing/customers/[id]`) shows a persistent `<MergePromptBanner>` for any customer that has a pending phone-match in the last 30 days (computed on read by re-running the dedup query).
- Owner clicks **Merge** → confirmation modal showing both records side-by-side → on confirm, calls `POST /api/marketing/customers/[id]/merge`.

There is **no separate inbox / queue UI** in v1; the merge prompts surface in-context on each affected customer's detail page. A merge inbox is post-v1 (open question §12.4).

---

## 8. CSV Import + Export

### 8.1 Accepted CSV shape

**Required columns:** `name`, `phone`.
**Optional columns:** `email`, `address`, `manual_tags`, `notes`.

- Header row is required; column order is irrelevant.
- Column names are case-insensitive (`Name`, `name`, `NAME` all accepted).
- `manual_tags` is pipe-separated: `vip|kedai-runcit|online-only`. Empty cells are valid.
- Extra columns are silently ignored (forward-compatible).
- **Encoding:** UTF-8. The parser sniffs BOM and strips it.
- **Delimiter:** comma. Semi-colon delimiters are detected and accepted (common for Excel exports with European locale).
- **Maximum rows after header:** 5,000 (rejects bigger files with a clear error pointing at "split your file or contact support").
- **Maximum file size:** 5 MB.

### 8.2 Two-phase commit

```
┌────────────────────────────────────────────────────────────────┐
│  Phase 1: Upload                                               │
│  POST /api/marketing/customers/csv-import (multipart)          │
│  → stores file in Supabase Storage (private bucket)            │
│  → inserts customer_csv_imports row, status='uploaded'         │
│  → returns { import_id }                                       │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           v
┌────────────────────────────────────────────────────────────────┐
│  Phase 2: Preview (dry-run)                                    │
│  POST /api/marketing/customers/csv-import/[id]/preview         │
│  → reads file, parses, normalizes each row                     │
│  → runs dedupOnCreate() per row (no writes)                    │
│  → writes preview json to row, status='previewed'              │
│  → returns full preview to client                              │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           v
┌────────────────────────────────────────────────────────────────┐
│  Phase 3: Commit                                               │
│  POST /api/marketing/customers/csv-import/[id]/commit          │
│  → verifies status='previewed' AND expires_at > now()          │
│  → in a single transaction:                                    │
│      INSERT all rows in preview.created                        │
│      INSERT one customer.created outbox row per inserted row   │
│      UPDATE import row: status='committed'                     │
│  → returns counts { created, merged, rejected }                │
└────────────────────────────────────────────────────────────────┘
```

### 8.3 Preview row outcomes

For each parsed row, classify into exactly one bucket:

- **`rejected`** — bad row, will NOT insert. Reasons: missing required field, unparseable phone, malformed email, duplicate phone within the same upload (only the first occurrence counts; later ones are rejected with reason `"duplicate within upload"`).
- **`merged`** — phone matches an existing customer with the same normalized name. **No insert** at commit; reported informationally. (We do NOT auto-update the existing customer's fields from the CSV in v1 — that's a "CSV merge" feature, post-v1.)
- **`created`** — will insert at commit.
- **`prompt`** — phone matches an existing customer with a different name. v1 behaviour: **bucket into `rejected` with reason `"phone collision (existing: {name})"`** to keep CSV import deterministic. The owner can manually add via the CRM if they really want a second record. (Avoids polluting the system with prompt-state rows from a bulk operation.)

### 8.4 Error reporting

```jsonc
// preview JSON shape stored on customer_csv_imports.preview
{
  "summary": { "total_rows": 412, "created": 380, "merged": 25, "rejected": 7 },
  "created":  [ { "row": 2, "name": "Ali bin Abu", "phone_e164": "+60123456789" }, … ],
  "merged":   [ { "row": 5, "name": "Siti Sara", "phone_e164": "+60134567890", "existing_id": "uuid" }, … ],
  "rejected": [ { "row": 9, "reason": "missing phone" }, { "row": 11, "reason": "duplicate within upload" }, … ]
}
```

The UI renders three collapsible sections with row numbers so the owner can open their CSV in Excel and jump to the offending lines.

### 8.5 Export shape

Single GET endpoint streams CSV. Columns (header row first):

```
name,phone,email,address,manual_tags,auto_tags,total_spend_myr,order_count,last_purchase_at,notes,created_at
```

- Phone is exported in normalized E.164 (`+60123456789`).
- Tags are pipe-separated.
- Dates are ISO 8601 UTC (`2026-06-12T07:00:00Z`).
- No pagination — streaming response. For businesses with >50k customers this would need streaming with cursoring, but v1 expects <10k per business and 5,000 is the import cap, so a 50k export is a future problem.

### 8.6 Limits (v1)

| Limit | Value | Rationale |
|-------|------:|-----------|
| Max import file size | 5 MB | Comfortably covers 5,000 typical rows; rejects accidental Excel binary uploads. |
| Max rows per import | 5,000 | Keeps preview parse < 5 seconds on Vercel free tier. |
| Import preview retention | 24 hours | After that, `status='expired'` and commit endpoint rejects. |
| Concurrent in-flight imports per business | 1 | Reject second upload with 409 until the first commits or expires. |

---

## 9. Permissions

### 9.1 Per-surface mapping against `lib/permissions.ts`

The current matrix has Marketing as `*` for `owner` and `manager`, and `undefined` (no access) for all others. That covers the **desktop / management** flows cleanly. But there's a single edge case that needs a tweak: **cashier needs to add a customer at POS checkout**.

**Two options, with my recommendation:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. Keep matrix unchanged; cashier-write happens through Sales' POS endpoint, which server-side calls Marketing's helper with elevated scope** | Matrix stays clean (cashier truly never accesses Marketing surfaces directly). | Couples Sales' POS handler to a Marketing internal helper; harder to reason about RLS in tests. | ✅ |
| **B. Extend `cashier.marketing` to `{ customers: 'rw' }`** | Symmetric to `sales.pos`; cashier can call `/api/marketing/customers` directly. | Cashier can also accidentally hit `/marketing/customers` UI; we'd have to hide it via `RequirePermission surface="full_crm"` or similar. More moving parts. | — |

Recommended: **Option A.** Concretely:
- `lib/permissions.ts` unchanged for cashier.
- Sales' POS server handler (under Asyraf's own scope) imports and calls a server-side helper `lib/marketing/upsertFromPos.ts` that uses the service-role Supabase client to bypass RLS, scoping every write to `current_business_id`. Helper signature: `upsertCustomerFromPos(businessId, { name, phone, source: 'pos' })`.
- The helper still goes through the dedup pipeline (§7) and still writes a `customer.created` outbox event.

### 9.2 Surface × role matrix

| Surface | owner | manager | accountant | hr_officer | cashier | staff |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| `/marketing` (landing) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/marketing/customers` (list + detail) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/marketing/customers/import` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/marketing/content` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /api/marketing/customers` (direct) | ✅ | ✅ | ❌ | ❌ | ❌ (uses Sales POS helper) | ❌ |
| `GET  /api/marketing/customers/search` (typeahead) | ✅ | ✅ | ❌ | ❌ | ✅ via Sales POS shell | ❌ |
| All CSV endpoints | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Content endpoints | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> The one entry where cashier reads Marketing — the customer typeahead — is enforced at the API middleware: `cashier` is allowed to call `GET /api/marketing/customers/search` because the surface is wired to `sales.pos`. The middleware special-cases this route: `canSurface(role, 'sales', 'pos') || canSurface(role, 'marketing', 'customers')`. Documented inline in the handler.

### 9.3 RLS posture

Every Marketing table has `enable row level security` and at minimum a `business_id = current_business_id()` filter on every operation (SELECT / INSERT / UPDATE / DELETE). Listed per-table in §2. No role-aware RLS within a business in v1 — role gating happens at the API + UI layers. (The Phase 0 RBAC harness already covers role × pillar; we don't re-implement it at the DB.)

---

## 10. Testing Strategy

Built on the **vitest** harness Phase 0 establishes. (If Phase 0 ships Jest instead, swap; assertions stay identical.)

### 10.1 Unit tests

Pure logic, no DB:

- `lib/marketing/phone.ts`
  - Fixture table of ~40 Malaysian phone formats → expected normalized E.164.
  - Edge cases: empty string, only whitespace, leading `+`, missing country code, too short, too long, contains alphabetic.
- `lib/marketing/dedup.ts` (with mocked DB)
  - `null phone` → `new`.
  - Exact phone + exact name → `merge`.
  - Exact phone + different name → `prompt`.
  - Exact phone but match has `merged_into_id != null` → `new` (tombstone excluded).
- `supabase/functions/marketing-tag-refresh/computeAutoTags()`
  - Table-driven: each segment + combinations + boundary days (29.99 vs 30.01).
  - `at-risk` does NOT fire for a customer that was never `repeat` / `vip`.
  - `new` excluded once `order_count >= 2`.

### 10.2 RLS tests

For every Marketing table — `customers`, `customer_tag_history`, `customer_csv_imports`, `content_plan`, `content_plan_media` — two business fixtures (`biz_a`, `biz_b`):

| # | Assertion | Expected |
|---|-----------|----------|
| 1 | `biz_a` user can SELECT their own rows | rows returned |
| 2 | `biz_a` user can NOT SELECT `biz_b` rows | empty result set |
| 3 | `biz_a` user can NOT UPDATE `biz_b` rows | 0 rows affected (RLS denies) |
| 4 | `biz_a` user can NOT INSERT with `business_id = biz_b.id` | RLS rejects via WITH CHECK |
| 5 | `biz_a` user can NOT DELETE `biz_b` rows | 0 rows affected |

Total: **25 RLS tests** (5 tables × 5 assertions). Re-uses the existing Phase 0 RLS harness factory.

### 10.3 API integration tests

For every API endpoint listed in §4.1:
- **Positive** test for each role that should succeed (manager, owner).
- **Negative** test (returns 403) for each role that should be denied (accountant, hr_officer, cashier-on-non-typeahead, staff).
- Cross-business isolation test (`biz_a` token cannot read `biz_b` customer by id even via direct URL).

Critical positive flows:
- `POST /api/marketing/customers` returns `action: "created"` on first call, `action: "merged"` on second call with same phone + same name, `action: "prompt"` on third call with same phone + different name.
- CSV import golden path: upload → preview (with mixed created/merged/rejected fixture) → commit → all customers exist + N outbox events appended.

### 10.4 Event-bus integration tests

- `customer.created` outbox row appears in `events_outbox` within the same transaction as the `customers` insert (verify via concurrent read in another connection — committed-only visible after commit).
- `customer.merged` outbox row appears when merge endpoint runs; foreign tables (mocked `orders`, `bookings`, etc.) are re-pointed within the same transaction.
- `customer.tag_changed` only emits for movers (verify with two consecutive Edge Function runs on the same fixture: first emits N, second emits 0).
- Listener idempotency: replaying the same `invoice.paid` event id twice yields a single metric increment.

### 10.5 Component tests

- `<TagBadge>` renders distinct styles for `kind="auto"` vs `kind="manual"`.
- `<CsvImportWizard>` cannot advance from Preview → Confirm if `rejected.length > 0` without an explicit "I understand, skip rejected rows" checkbox.
- `<MergePromptBanner>` only renders if the API response includes `potential_match`.

### 10.6 CI gate

A test that fails CI if any new file under `app/api/marketing/*` is added without a corresponding row in the role × surface fixture used by the integration suite. (Implementation: simple grep + diff in a script, similar to Phase 0's RBAC fail-on-untested-route gate.)

---

## 11. Implementation Milestones

Each milestone has a clear **Definition of Done** and a **blocked-on** list naming exactly which other-dev (Admin/Finance/Ops) contracts are required. Asyraf can land M1–M3 + M5 in any order without the other dev. M4 and M6 require the cross-pillar payloads (D1–D4 in §3.3).

### M1 — Schema + RLS + `customer.created` end-to-end stub

**Scope:**
- Migration: `supabase/migrations/20260615000000_marketing_core.sql` creating `customers`, `customer_tag_history`, `customer_csv_imports`, `content_plan`, `content_plan_media` with all RLS policies + indexes from §2.
- `lib/events/types.ts` — extend `EventName` with `customer.merged`, `customer.tag_changed`, `customer.updated`. Add `CustomerMergedPayload`, `CustomerTagChangedPayload`, `CustomerUpdatedPayload`. Add `"public_booking_page"` to `CustomerCreatedPayload.source`.
- `lib/marketing/phone.ts` (helper).
- `lib/marketing/dedup.ts` (helper).
- `app/api/marketing/customers/route.ts` — `POST` only (creates + outbox event + dedup).
- POS stub script: a CLI / dev page that POSTs to `/api/marketing/customers` and verifies an `events_outbox` row appears.

**Files touched:** new migration; `lib/events/types.ts`; `lib/marketing/*` (new); `app/api/marketing/customers/route.ts` (new); test fixtures in `tests/marketing/*` (new).

**Tests:** all of §10.1 (phone, dedup), §10.2 (5 RLS × 5 tables), §10.3 positive for `POST /customers`, §10.4 outbox-in-tx test.

**Definition of done:** A `curl POST /api/marketing/customers` inserts a row, emits a `customer.created` outbox entry in the same transaction, and the second identical curl returns `action: "merged"`. RLS isolation verified between two seeded businesses. CI green.

**Blocked-on:** none (Phase 0 RBAC harness + Supabase Auth + events_outbox dispatcher must be merged first).

### M2 — Phone dedup + CRM list/detail UI (desktop primary)

**Scope:**
- Remaining API routes: `GET /customers`, `GET /customers/[id]`, `PATCH /customers/[id]`, `POST /customers/[id]/merge`, `GET /customers/search`.
- UI: `/marketing/customers` (list — desktop table + mobile cards), `/marketing/customers/[id]` (desktop full profile + mobile summary), `/marketing/customers/new` (manual add form).
- Components: `<CustomerListTable>`, `<CustomerListMobile>`, `<CustomerFilters>`, `<CustomerProfileDesktop>`, `<CustomerProfileMobile>`, `<CustomerForm>`, `<TagBadge>`, `<MergePromptBanner>`.
- Replace `PillarStub` in `app/(app)/marketing/customers/page.tsx`.

**Files touched:** `app/api/marketing/customers/**` (new sub-routes); `app/(app)/marketing/customers/**` (rewrite); `components/marketing/**` (new); `lib/marketing/schemas.ts` (new).

**Tests:** §10.3 for all new routes (positive + negative per role + cross-business). Component tests for `<MergePromptBanner>`.

**Definition of done:** Owner can list, search, open, edit, and merge customers from the desktop CRM. Mobile shows a list summary view. Merge endpoint re-points placeholder FK tables (use `_marketing_test_orders` test-only table; real `orders` FK lands when Operations does).

**Blocked-on:** none for the v1 UX. D6 (Admin Storage file id) only matters for content_plan, not customers.

### M3 — CSV import / export with dry-run preview

**Scope:**
- Endpoints: upload, preview, commit, export.
- UI: `/marketing/customers/import` (desktop) with `<CsvImportWizard>` (Upload → Preview table → Confirm).
- Supabase Storage bucket `csv-imports` (private, per-business path).
- Server-side CSV parser (`papaparse` or hand-rolled — single dependency add if needed).

**Files touched:** `app/api/marketing/customers/csv-import/**` (new); `app/api/marketing/customers/csv-export/route.ts` (new); `app/(app)/marketing/customers/import/page.tsx` (new); `components/marketing/CsvImportWizard.tsx` (new); `lib/marketing/csv.ts` (new — parse + render helpers).

**Tests:** golden-file CSV fixtures with mixed outcomes; commit emits N outbox events; export round-trip (export → re-import yields zero new customers because all match).

**Definition of done:** Owner can upload a 5,000-row CSV, see preview categorized into created/merged/rejected with row numbers, click Confirm, and have all customers land in the database with one `customer.created` outbox event per insertion. Export downloads correctly-shaped CSV.

**Blocked-on:** none. Optional dependency on Supabase Storage configuration which Phase 0 should already cover; if not, document in §12.

### M4 — Auto-segmentation tag refresh (Edge Function on schedule)

**Scope:**
- `supabase/functions/marketing-tag-refresh/index.ts` implementing the pseudo-code in §6.5.
- Schedule definition (Supabase `config.toml` or `pg_cron` row).
- Backfill one-shot script (manual trigger) for existing customers post-M1.
- `customer.tag_changed` outbox emission.

**Files touched:** `supabase/functions/marketing-tag-refresh/**` (new); `supabase/config.toml` updated.

**Tests:** §10.1 `computeAutoTags` table-driven; §10.4 idempotency (run twice → second emits zero events).

**Definition of done:** After seeding 100 fixture customers with varied purchase histories, running the function once produces the expected `auto_tags` array on each row + the expected count of `customer.tag_changed` events. Running it a second time produces zero new events. Function completes in <30s for 10k customers.

**Blocked-on:** D8 (dispatcher exposes event_id) is helpful but not strictly needed here — Marketing emits the events; consumers are not yet wired.

### M5 — Content Calendar UI

**Scope:**
- Endpoints: `GET / POST / PATCH / DELETE /api/marketing/content`.
- UI: `/marketing/content` desktop calendar + `/marketing/content/new` mobile entry form.
- Components: `<ContentCalendar>`, `<ContentEntryEditor>`, `<ContentStatusBadge>`.
- Media attachment: stores `file_id` references in `content_plan_media`; renders thumbnails by calling Admin Storage's signed-URL endpoint (D6 contract).

**Files touched:** `app/api/marketing/content/**` (new); `app/(app)/marketing/content/**` (replace stub); `components/marketing/Content*` (new).

**Tests:** API role coverage (§10.3); component tests for calendar status colours and status transitions.

**Definition of done:** Owner can plan a TikTok / IG / FB post on the desktop calendar, attach a media file (mock file id until D6 lands), move it through `idea → drafted → scheduled → posted`. Mobile entry form lets owner quickly capture an idea.

**Blocked-on:** D6 (Admin Storage `files` table). Marketing can ship M5 without FK on `content_plan_media.file_id`; FK added in a follow-up migration once Admin lands.

### M6 — Cross-pillar metric updates + analytics view

**Scope:**
- Async listeners for `invoice.paid`, `order.delivered`, `booking.completed`, `lead.converted` — each updates `customers` metrics idempotently.
- Per-handler dedup table `marketing_event_dedup (event_id uuid primary key, processed_at timestamptz default now())` — drop if D8 provides global dedup.
- `/marketing` landing page KPI cards reading the now-populated metrics: `total_customers`, `new_this_month`, `vip_count`, `dormant_count`, `at_risk_count`.
- Optional: a Postgres view `customer_analytics_v1` aggregating per-business segment counts, for the future Marketing AI agent to read.

**Files touched:** `supabase/functions/marketing-event-listeners/index.ts` (new — or attached to existing Phase 0 dispatcher); `app/(app)/marketing/page.tsx` (replace stub with KPI cards); migration adding `marketing_event_dedup` (if needed) + `customer_analytics_v1` view.

**Tests:** §10.4 listener idempotency for each of the 4 events. Integration test seeding 10 invoices for the same customer and asserting `total_spend_myr` matches the sum.

**Definition of done:** When the other dev's Finance / Operations flows fire `invoice.paid` / `order.delivered` / `booking.completed`, Marketing's customer row updates within seconds (async). KPI cards render live numbers. No double-counting on event replays.

**Blocked-on:**
- **D1 + D2** — `customer_id` on invoices + on `InvoicePaidPayload`. **Hard block.**
- **D3 + D4** — Operations payloads for `order.delivered` / `booking.completed`. **Hard block** for those two listeners only; `invoice.paid` can ship alone.
- **D7** — optional (notifications); listener degrades gracefully without.
- **D8** — optional (dispatcher global dedup); Marketing's per-pillar dedup table is the fallback.

### Milestone sequencing chart

```
M1 (schema, customer.created) ──────► M2 (CRM UI) ──────► M3 (CSV)
                  │
                  ├─────────────────► M5 (Content calendar)  [needs D6 for media]
                  │
                  └─► M4 (auto-tags) ──► M6 (metric listeners + analytics) [needs D1–D4]
```

Asyraf can do M1 → M2 → M3 → M5 → M4 → M6 if the other dev is slow. The first four are zero-dependency. M6 is the integration handshake.

---

## 12. Open Questions for the User

Bullet list of decisions to confirm before implementation starts. Each one is small enough to resolve in a chat; none should derail the plan.

1. **§6.4 — Auto-tag thresholds: hard-coded in v1, or per-business overridable?** The pillar spec leaves it open. Recommendation: hard-code in v1 (one less settings surface; defaults are well-chosen) and add a `business_segmentation_overrides` table post-v1 if any beta customer asks. Confirm.

2. **§2 — Notes timeline: single `notes` text field on `customers`, or a normalized `customer_notes[]` table?** v1 plan ships a single field for simplicity. Confirm — the design splits cleanly into a table later without breaking the API.

3. **§4.1 — `DELETE /api/marketing/customers/[id]` behaviour: return 405 vs allow tombstone delete?** Recommendation: 405 in v1 with a clear error message pointing to merge. Confirm.

4. **§7.4 — Should we ship a dedicated "merge inbox" UI in v1, or only in-context banners?** Plan says in-context banners only. The inbox is a nice-to-have but adds a screen. Confirm.

5. **§3.2.5 — POS attach-customer: should Sales call Marketing's API synchronously, or fire `customer.created` async and let Marketing return a customer_id via a second event?** Plan picks synchronous API call (cleaner UX; cashier needs the id immediately to attach to the sale). Confirm.

6. **§3.3 D7 — Admin notification feed contract: should Marketing block on this, or ship its async listeners as silent no-ops until Admin lands?** Plan picks silent no-ops with `audit_log` capture. Confirm.

7. **§8.6 — CSV import row cap: 5,000 in v1.** Some businesses (boutiques with 8+ years of records) may push 10k. Confirm 5k or raise to 10k. (Implementation cost is identical; just a guardrail number.)

8. **§3.1.4 — Should we ship `customer.updated` in v1, or only when the first consumer needs it?** Plan ships it because it's cheap and avoids a future migration. Confirm.

9. **§4.2.6 — CSV import preview-state retention: 24h.** Confirm. (Shorter is safer; longer is more forgiving for owners who upload then go home.)

10. **§8.3 — CSV row with phone collision + name mismatch: bucket as `rejected` (current plan) vs `prompt`?** Plan picks `rejected` for deterministic bulk behaviour. Confirm.

11. **§9.1 — Cashier customer creation: helper-with-service-role vs matrix extension.** Plan picks helper (Option A). Confirm.

12. **§3.2.5 + D5 — Does Asyraf want to spec the Sales `convert-to-customer` flow inside the Sales plan (separate doc) or here?** Recommendation: spec it in `docs/plans/sales-implementation-plan.md` and only contract the API call here. Confirm.

---

## Appendix A — Quick reference: file paths the next implementation pass will touch

```
docs/plans/marketing-implementation-plan.md        # this doc
docs/README.md                                     # add link to this plan (small edit)

lib/events/types.ts                                # extend EventName + payload interfaces (M1)
lib/marketing/phone.ts                             # NEW (M1)
lib/marketing/dedup.ts                             # NEW (M1)
lib/marketing/schemas.ts                           # NEW (M2)
lib/marketing/csv.ts                               # NEW (M3)
lib/marketing/upsertFromPos.ts                     # NEW (M1, used by Sales POS in M6)

app/api/marketing/customers/route.ts               # NEW (M1, M2)
app/api/marketing/customers/[id]/route.ts          # NEW (M2)
app/api/marketing/customers/[id]/merge/route.ts    # NEW (M2)
app/api/marketing/customers/search/route.ts        # NEW (M2)
app/api/marketing/customers/csv-import/route.ts    # NEW (M3)
app/api/marketing/customers/csv-import/[id]/preview/route.ts  # NEW (M3)
app/api/marketing/customers/csv-import/[id]/commit/route.ts   # NEW (M3)
app/api/marketing/customers/csv-export/route.ts    # NEW (M3)
app/api/marketing/content/route.ts                 # NEW (M5)
app/api/marketing/content/[id]/route.ts            # NEW (M5)

app/(app)/marketing/page.tsx                       # rewrite (M6 — KPI cards)
app/(app)/marketing/customers/page.tsx             # rewrite (M2)
app/(app)/marketing/customers/[id]/page.tsx        # NEW (M2)
app/(app)/marketing/customers/new/page.tsx         # NEW (M2)
app/(app)/marketing/customers/import/page.tsx      # NEW (M3)
app/(app)/marketing/content/page.tsx               # rewrite (M5)
app/(app)/marketing/content/new/page.tsx           # NEW (M5)

components/marketing/CustomerListTable.tsx         # NEW (M2)
components/marketing/CustomerListMobile.tsx        # NEW (M2)
components/marketing/CustomerFilters.tsx           # NEW (M2)
components/marketing/CustomerProfileDesktop.tsx    # NEW (M2)
components/marketing/CustomerProfileMobile.tsx     # NEW (M2)
components/marketing/CustomerForm.tsx              # NEW (M2)
components/marketing/TagBadge.tsx                  # NEW (M2)
components/marketing/MergePromptBanner.tsx         # NEW (M2)
components/marketing/CsvImportWizard.tsx           # NEW (M3)
components/marketing/ContentCalendar.tsx           # NEW (M5)
components/marketing/ContentEntryEditor.tsx        # NEW (M5)
components/marketing/ContentStatusBadge.tsx        # NEW (M5)

supabase/migrations/20260615000000_marketing_core.sql              # NEW (M1)
supabase/migrations/20260620000000_marketing_storage_fk.sql        # NEW (M5 follow-up, after D6)
supabase/functions/marketing-tag-refresh/index.ts                  # NEW (M4)
supabase/functions/marketing-event-listeners/index.ts              # NEW (M6) — or merged into Phase 0 dispatcher

tests/marketing/phone.test.ts                      # NEW (M1)
tests/marketing/dedup.test.ts                      # NEW (M1)
tests/marketing/rls.test.ts                        # NEW (M1)
tests/marketing/api-customers.test.ts              # NEW (M1, expanded M2)
tests/marketing/api-csv.test.ts                    # NEW (M3)
tests/marketing/api-content.test.ts                # NEW (M5)
tests/marketing/tag-refresh.test.ts                # NEW (M4)
tests/marketing/event-listeners.test.ts            # NEW (M6)
```

## Appendix B — Quick reference: events Marketing touches

```
EMITS (Marketing → others):
  customer.created           — every customer insert; existing payload, add "public_booking_page" source
  customer.merged            — NEW; auto + manual merge; routes consumers re-point FKs
  customer.tag_changed       — NEW; nightly Edge Function emits only on transitions
  customer.updated           — NEW; CRM field edits; cheap event for future consumers

CONSUMES (others → Marketing):
  invoice.paid               — Finance/Sales → update purchase metrics       [needs D1, D2]
  order.delivered            — Operations   → update purchase metrics        [needs D3]
  booking.completed          — Operations   → update purchase metrics        [needs D4]
  lead.converted             — Sales        → create customer (idempotent)   [Asyraf-owned, D5]
  booking.confirmed          — Operations   → explicit no-op in v1
```

## Appendix C — Schema cheat sheet (one screen)

```
businesses (existing)
  └── customers (NEW, M1)
        ├── customer_tag_history (NEW, M1)
        ├── customer_csv_imports (NEW, M1)
        └── (referenced by) invoices.customer_id          [Finance: D1]
                            orders.customer_id            [Operations]
                            bookings.customer_id          [Operations]
                            leads.converted_customer_id   [Sales: Asyraf]
                            sales.customer_id             [Sales: Asyraf]
  └── content_plan (NEW, M1)
        └── content_plan_media (NEW, M1) → files.id       [Admin: D6]

events_outbox (existing) ← appended by every Marketing mutation route
audit_log (existing)     ← appended by Marketing listeners for diagnostic events
marketing_event_dedup (NEW, M6, optional if dispatcher provides global dedup)
```
