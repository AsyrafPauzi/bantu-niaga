# Sales Pillar — Implementation Plan

> **Status:** Draft v1 · 2026-06-12
> **Owner:** Sales pillar dev (parallel with Marketing, Finance, Operations workers)
> **Companion docs:**
> - [`docs/pillars/05-sales.md`](../pillars/05-sales.md) — feature spec
> - [`docs/v1-core-scope.md`](../v1-core-scope.md) §Pillar 5 — locked scope
> - [`docs/plans/marketing-implementation-plan.md`](./marketing-implementation-plan.md) — sister doc, same skeleton
> - [`docs/plans/marketing-decisions.md`](./marketing-decisions.md) — Q5, Q7, Q11 bind Sales (see §3 below)
> - [`docs/architecture/cross-pillar-sync.md`](../architecture/cross-pillar-sync.md) — event bus contract
>
> **Cross-pillar coupling (read this if nothing else):**
> Sales is the most plugged-in pillar in v1. It writes customers into Marketing (via a Marketing-owned wrapper, never directly), emits POS sale events that Finance turns into ledger transactions and Operations turns into stock decrements (when Micro Stock Tracker is active), and reads the Operations product catalog for the POS grid. Three handshakes must be airtight: (1) customer upsert through `lib/marketing/upsertFromPos.ts`, (2) `sale.completed` payload that Finance can post a `transactions` row from without follow-up reads, (3) `customer_external_refs` registration so Marketing's merge handler re-points every Sales-owned customer FK on `customer.merged`.

---

## 1. Goals & Non-Goals

### 1.1 Goals

- **G1 — Counter-speed POS.** A cashier on a phone rings up a 3-item cash sale, gets a receipt screen, and is ready for the next customer in under 5 seconds.
- **G2 — Three payment methods, one surface.** Cash, static DuitNow QR (display the merchant's pre-printed QR), and dynamic DuitNow QR per amount (generated client-side from the merchant's DuitNow ID + sale total + reference). No FPX, no gateway. No merchant account required.
- **G3 — Honest money.** Every POS sale becomes a Finance `transactions` row via `sale.completed`. Voids and refunds are ledger reversals (not deletes); the original sale stays auditable.
- **G4 — Lead pipeline that doesn't lose attribution.** Lead persists with `status='WON'` and `converted_customer_id` on conversion (per `marketing-decisions.md` Q7). Pipeline UI filters out WON by default; "Won" column is opt-in.
- **G5 — Clean cross-pillar boundary.** Sales never writes to `customers` directly. Cashier customer search and upsert hit `/api/sales/pos/customer-*` endpoints that internally call `lib/marketing/upsertFromPos.ts` (per `marketing-decisions.md` Q11).
- **G6 — Receipts that satisfy SST.** When `businesses.sst_enabled = true`, the POS receipt and any printable view show `Subtotal · SST · Total` split, matching the Finance invoice convention.
- **G7 — Daily close-out.** End-of-day reconciliation captures expected-vs-actual cash and DuitNow totals per cashier per day, locking sales for the period so refunds escalate to credit-note flow.

### 1.2 Non-Goals

- **N1 — No multi-cashier shift handover.** v1 ships single open close-out per business per day. Per-cashier shifts (handover at lunch) is a v2 add-on.
- **N2 — No barcode scanning or thermal printer pairing.** Those live in the **Hardware & Advanced POS Extensions** add-on (`pillars/05-sales.md` §3).
- **N3 — No stale-deal alarms.** Live in the **Stale Deal & Detail Alarms** add-on.
- **N4 — No online storefront / public POS page.** The POS is a staff-side surface only.
- **N5 — No layaway, instalments, deposits, partial advance payments.** A sale is paid-in-full at ring-up in v1 core.
- **N6 — No FPX, cards, e-wallets, payment gateways.** Those land later in the Finance **Payment Gateway Connector** add-on (`docs/v1-core-scope.md` §Pillar 2).
- **N7 — No table management.** Add-on.
- **N8 — No offline POS cache.** Add-on (network drop = sale fails to commit; UI must surface clearly).
- **N9 — Sales does NOT own customer dedup, segmentation, or merge.** Marketing owns those. Sales emits `customer.created` and consumes nothing customer-side.

---

## 2. Data Model

### 2.1 Table inventory (Sales-owned)

| Table | Purpose | Owns FK to |
|-------|---------|-----------|
| `leads` | Lead pipeline cards | `customers` (nullable, on convert), `pos_sales` (nullable, attribution) |
| `lead_notes` | Per-lead notes timeline | `leads` |
| `pos_sales` | One row per POS ring-up | `users` (cashier), `customers` (nullable), `leads` (nullable), `daily_close_outs` (nullable) |
| `pos_sale_items` | Line items on a sale | `pos_sales`, `products`, `product_variants` |
| `pos_refunds` | Refund header (post-sale, post-closeout) | `pos_sales`, `users` (cashier + manager) |
| `pos_refund_items` | Per-line refund quantities | `pos_refunds`, `pos_sale_items` |
| `daily_close_outs` | End-of-day reconciliation | `users` (closer) |

Voids are NOT a separate table — they are a status flip on `pos_sales` (`status='voided'`) with `voided_at`, `voided_by_user_id`, `void_reason` columns. Reasoning: a void is the original ring-up annulled before close-out, so it logically belongs on the source row; a refund is a downstream reversal so it gets its own header.

`pos_sale_payments` is omitted — v1 core supports one payment method per sale (cash OR DuitNow QR static OR DuitNow QR dynamic). Split payments are a future add-on. When that lands, a new `pos_sale_payments` table can replace the `payment_method` column on `pos_sales` (additive migration, no semantic break).

All Sales tables include `business_id uuid not null references businesses(id) on delete cascade` and RLS policies derived from the templates in `00000000000001_rbac_helpers.sql`.

### 2.2 `pos_sales`

```sql
create table public.pos_sales (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  sale_number              text not null,
  cashier_user_id          uuid not null references public.users (id) on delete restrict,
  customer_id              uuid references public.customers (id) on delete set null,
  lead_id                  uuid references public.leads (id) on delete set null,

  subtotal_myr             numeric(12, 2) not null check (subtotal_myr >= 0),
  discount_type            text check (discount_type in ('amount', 'pct')),
  discount_value           numeric(12, 2) check (discount_value >= 0),
  discount_amount_myr      numeric(12, 2) not null default 0 check (discount_amount_myr >= 0),
  sst_amount_myr           numeric(12, 2) not null default 0 check (sst_amount_myr >= 0),
  rounding_adjustment_myr  numeric(12, 2) not null default 0,
  total_myr                numeric(12, 2) not null check (total_myr >= 0),

  payment_method           text not null check (
    payment_method in ('cash', 'duitnow_qr_static', 'duitnow_qr_dynamic')
  ),
  duitnow_reference        text,
  duitnow_qr_payload       text,
  payment_received_myr     numeric(12, 2),
  change_myr               numeric(12, 2) not null default 0,

  status                   text not null default 'completed' check (
    status in ('completed', 'voided')
  ),
  voided_at                timestamptz,
  voided_by_user_id        uuid references public.users (id) on delete set null,
  void_reason              text,
  close_out_id             uuid references public.daily_close_outs (id) on delete set null,

  manager_approval_user_id uuid references public.users (id) on delete set null,
  manager_approval_reason  text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (business_id, sale_number),
  check ((status = 'voided') = (voided_at is not null))
);

create index pos_sales_business_created_idx
  on public.pos_sales (business_id, created_at desc);
create index pos_sales_business_status_idx
  on public.pos_sales (business_id, status);
create index pos_sales_lead_idx
  on public.pos_sales (lead_id) where lead_id is not null;
create index pos_sales_customer_idx
  on public.pos_sales (customer_id) where customer_id is not null;
create index pos_sales_open_closeout_idx
  on public.pos_sales (business_id, created_at)
  where close_out_id is null and status = 'completed';

create trigger pos_sales_set_updated_at
  before update on public.pos_sales
  for each row execute function public.set_updated_at();

alter table public.pos_sales enable row level security;
-- RLS: Pattern A (SELECT, tenant-scoped) + Pattern B (INSERT/UPDATE, cashier-or-full). See §9.3.
```

Notes:

- `sale_number` is per-business sequential, format `POS-{YYYY}-{NNNNNN}`. Year reset mirrors `businesses.invoice_number_year_reset`. Numbering is acquired inside the create-sale transaction via `SELECT … FOR UPDATE` on a `pos_sale_counters (business_id, year, last_n)` table; see §6.4.
- `duitnow_qr_payload` stores the literal EMV string emitted to the customer for forensic audit (refund reconciliation against bank statement).
- `rounding_adjustment_myr` captures the cent-rounding applied to the customer-facing total under Bank Negara's 5-sen rounding rule (see §6.3).
- The `check ((status = 'voided') = (voided_at is not null))` constraint enforces that voided sales must have a void timestamp.
- `manager_approval_user_id` records the manager who entered the PIN for discounts above the threshold (see §6.1).

### 2.3 `pos_sale_items`

```sql
create table public.pos_sale_items (
  id                       uuid primary key default gen_random_uuid(),
  sale_id                  uuid not null references public.pos_sales (id) on delete cascade,
  business_id              uuid not null references public.businesses (id) on delete cascade,

  product_id               uuid references public.products (id) on delete restrict,
  product_variant_id       uuid references public.product_variants (id) on delete restrict,
  name_snapshot            text not null,
  sku_snapshot             text,

  qty                      numeric(12, 3) not null check (qty > 0),
  unit_price_myr           numeric(12, 2) not null check (unit_price_myr >= 0),
  line_subtotal_myr        numeric(12, 2) not null check (line_subtotal_myr >= 0),
  line_discount_myr        numeric(12, 2) not null default 0 check (line_discount_myr >= 0),
  sst_applies              boolean not null default false,
  sst_amount_myr           numeric(12, 2) not null default 0 check (sst_amount_myr >= 0),
  line_total_myr           numeric(12, 2) not null check (line_total_myr >= 0),

  position                 integer not null,
  created_at               timestamptz not null default now()
);

create index pos_sale_items_sale_idx
  on public.pos_sale_items (sale_id, position);
create index pos_sale_items_product_idx
  on public.pos_sale_items (product_id);

alter table public.pos_sale_items enable row level security;
-- RLS: Pattern A + Pattern B (cashier-writable). See §9.3.
```

`name_snapshot` and `sku_snapshot` are intentional duplications of `products.name` / `products.sku`. They guarantee receipts and refund flows still render correctly if Operations renames or deletes a product after the sale. The FK `on delete restrict` is the second line of defense.

### 2.4 `pos_refunds` and `pos_refund_items`

```sql
create table public.pos_refunds (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses (id) on delete cascade,
  refund_number             text not null,
  original_sale_id          uuid not null references public.pos_sales (id) on delete restrict,
  cashier_user_id           uuid not null references public.users (id) on delete restrict,
  manager_approval_user_id  uuid references public.users (id) on delete set null,

  refund_type               text not null check (refund_type in ('full', 'partial')),
  refund_subtotal_myr       numeric(12, 2) not null check (refund_subtotal_myr >= 0),
  sst_refund_myr            numeric(12, 2) not null default 0 check (sst_refund_myr >= 0),
  total_refund_myr          numeric(12, 2) not null check (total_refund_myr >= 0),

  refund_payment_method     text not null check (
    refund_payment_method in ('cash', 'duitnow_transfer')
  ),
  bank_reference            text,
  reason                    text not null,

  created_at                timestamptz not null default now(),
  unique (business_id, refund_number)
);

create index pos_refunds_business_created_idx
  on public.pos_refunds (business_id, created_at desc);
create index pos_refunds_original_sale_idx
  on public.pos_refunds (original_sale_id);

create table public.pos_refund_items (
  id                       uuid primary key default gen_random_uuid(),
  refund_id                uuid not null references public.pos_refunds (id) on delete cascade,
  business_id              uuid not null references public.businesses (id) on delete cascade,
  original_sale_item_id    uuid not null references public.pos_sale_items (id) on delete restrict,
  qty_refunded             numeric(12, 3) not null check (qty_refunded > 0),
  refund_unit_price_myr    numeric(12, 2) not null check (refund_unit_price_myr >= 0),
  refund_line_subtotal_myr numeric(12, 2) not null check (refund_line_subtotal_myr >= 0),
  refund_sst_myr           numeric(12, 2) not null default 0,
  refund_line_total_myr    numeric(12, 2) not null check (refund_line_total_myr >= 0),
  restocks                 boolean not null default false,
  created_at               timestamptz not null default now()
);

create index pos_refund_items_refund_idx
  on public.pos_refund_items (refund_id);

alter table public.pos_refunds enable row level security;
alter table public.pos_refund_items enable row level security;
-- RLS: Pattern A (SELECT) + Pattern C (INSERT/UPDATE, full-access only). See §9.3.
```

Notes:

- Cashiers can _initiate_ a refund via the API (the route is gated by `cashier.sales = 'rw'`), but they cannot write to `pos_refunds` directly because RLS only allows `current_user_has_full_access('sales')`. The route uses `lib/sales/refundService.ts` (server-only, service-role wrapper analogous to `lib/marketing/upsertFromPos.ts`) when the cashier-initiated refund is under the auto-approval threshold; above the threshold the route requires a manager PIN before service-role write. See §8.2.
- `refund_number` format: `RFD-{YYYY}-{NNNNNN}`, business-scoped sequence.
- `restocks` on `pos_refund_items` is the signal the Operations stock-decrement listener uses to know whether to _increment_ stock back. The flag defaults `false` because Micro Stock Tracker is an add-on; cashier opts in per line.

### 2.5 `leads` and `lead_notes`

```sql
create table public.leads (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,

  name                     text not null,
  phone_e164               text,
  channel                  text not null check (channel in (
    'whatsapp', 'instagram', 'tiktok', 'facebook',
    'walk_in', 'referral', 'web_form', 'other'
  )),
  interest                 text,
  value_estimate_myr       numeric(12, 2),

  status                   text not null default 'new' check (status in (
    'new', 'qualified', 'contacted', 'negotiating', 'won', 'lost'
  )),
  lost_reason              text,

  assigned_user_id         uuid references public.users (id) on delete set null,
  last_contacted_at        timestamptz,

  converted_customer_id    uuid references public.customers (id) on delete set null,
  converted_sale_id        uuid references public.pos_sales (id) on delete set null,
  converted_at             timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  check ((status = 'won') = (converted_at is not null)),
  check ((status = 'won') = (converted_customer_id is not null))
);

create index leads_business_status_idx
  on public.leads (business_id, status, last_contacted_at desc);
create index leads_phone_idx
  on public.leads (business_id, phone_e164)
  where phone_e164 is not null;
create index leads_converted_customer_idx
  on public.leads (converted_customer_id)
  where converted_customer_id is not null;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
-- RLS: Pattern A + Pattern C (full-access only). See §9.3.

create table public.lead_notes (
  id                       uuid primary key default gen_random_uuid(),
  lead_id                  uuid not null references public.leads (id) on delete cascade,
  business_id              uuid not null references public.businesses (id) on delete cascade,
  author_user_id           uuid not null references public.users (id) on delete restrict,
  body                     text not null,
  created_at               timestamptz not null default now()
);

create index lead_notes_lead_idx
  on public.lead_notes (lead_id, created_at desc);

alter table public.lead_notes enable row level security;
-- RLS: Pattern A + Pattern C. See §9.3.
```

Notes:

- The `check ((status = 'won') = (converted_customer_id is not null))` constraint enforces Q7 from `marketing-decisions.md`: a WON lead must have a customer FK; a non-WON lead must not. The system never archives leads.
- Default Kanban query filters `status not in ('won', 'lost')` — see §5.3 for the surface state matrix.
- `lib/sales/leads/qualifyTransitions.ts` enforces legal status transitions (e.g. `won` is terminal; `lost` is terminal; backwards transitions are allowed except _out of_ `won` — once converted, only a refund/void of the linked sale can undo the lead's WON state, and even then the lead stays WON because the customer record stays).

### 2.6 `daily_close_outs`

```sql
create table public.daily_close_outs (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses (id) on delete cascade,
  cashier_user_id             uuid not null references public.users (id) on delete restrict,
  close_out_date              date not null,

  opened_at                   timestamptz not null default now(),
  closed_at                   timestamptz,

  expected_cash_myr           numeric(12, 2) not null default 0,
  actual_cash_myr             numeric(12, 2),
  cash_variance_myr           numeric(12, 2),

  expected_duitnow_myr        numeric(12, 2) not null default 0,
  actual_duitnow_myr          numeric(12, 2),
  duitnow_variance_myr        numeric(12, 2),

  expected_total_myr          numeric(12, 2) not null default 0,
  actual_total_myr            numeric(12, 2),
  total_variance_myr          numeric(12, 2),

  sales_count                 integer not null default 0,
  voids_count                 integer not null default 0,
  refunds_count               integer not null default 0,

  notes                       text,
  status                      text not null default 'open' check (status in ('open', 'closed')),

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  unique (business_id, close_out_date),
  check ((status = 'closed') = (closed_at is not null))
);

create index daily_close_outs_business_date_idx
  on public.daily_close_outs (business_id, close_out_date desc);

create trigger daily_close_outs_set_updated_at
  before update on public.daily_close_outs
  for each row execute function public.set_updated_at();

alter table public.daily_close_outs enable row level security;
-- RLS: Pattern A + Pattern C. See §9.3.
```

Notes:

- `unique (business_id, close_out_date)` enforces N1: one close-out per business per day in v1.
- The `expected_*` columns are server-computed sums of unclosed sales for the day; `actual_*` is owner/manager input. The variance is server-computed on close.
- On `closed`, the server stamps `pos_sales.close_out_id` for every completed (non-voided) sale falling in that day's window, locking them from void.

### 2.7 `pos_sale_counters` (sequence helper)

```sql
create table public.pos_sale_counters (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  kind          text not null check (kind in ('sale', 'refund')),
  year          integer not null,
  last_n        integer not null default 0,
  primary key (business_id, kind, year)
);

alter table public.pos_sale_counters enable row level security;
-- RLS: Pattern A + Pattern B (cashier-writable, internal). See §9.3.
```

Internal helper table — never exposed via API. `lib/sales/saleNumber.ts` acquires a row-lock and increments; see §6.4.

### 2.8 Registry inserts for `customer_external_refs` (Q5)

Per `marketing-decisions.md` Q5, the Sales migration must register every Sales-owned customer FK so Marketing's merge handler re-points them on `customer.merged`:

```sql
insert into public.customer_external_refs (table_name, fk_column, pillar, notes) values
  ('leads',     'converted_customer_id', 'sales', 'lead → customer conversion target'),
  ('pos_sales', 'customer_id',           'sales', 'optional customer attached to POS sale');
```

`pos_refunds` does not own a customer FK directly (it goes through `pos_sales.customer_id`), so no row is needed. `lead_notes` does not own a customer FK either.

---

## 3. Cross-Pillar Contracts (most important section)

### 3.1 Events Sales emits

Four **new** events that must be added to `lib/events/types.ts`:

#### 3.1.1 `sale.completed` — emitted on every successful POS ring-up

```ts
export interface SaleCompletedPayload {
  sale_id: string;
  sale_number: string;
  cashier_user_id: string;
  customer_id: string | null;
  lead_id: string | null;
  subtotal_myr: number;
  discount_amount_myr: number;
  sst_amount_myr: number;
  rounding_adjustment_myr: number;
  total_myr: number;
  payment_method: "cash" | "duitnow_qr_static" | "duitnow_qr_dynamic";
  duitnow_reference: string | null;
  paid_at: string;
  line_items: Array<{
    sale_item_id: string;
    product_id: string | null;
    product_variant_id: string | null;
    name_snapshot: string;
    qty: number;
    unit_price_myr: number;
    line_total_myr: number;
    sst_applies: boolean;
  }>;
}
```

**Emitter:** `POST /api/sales/pos/sales` (Sales) — inside the same SQL transaction that inserts `pos_sales` + `pos_sale_items`.

**Consumers:**

- **Finance** — creates a `transactions` row, type `REVENUE`, amount `total_myr`, payment-method-mapped account (`cash` → `Cash`, `duitnow_qr_*` → `Bank`), `category = 'Sales Income'`. Tags `linked_pos_sale_id`. Idempotent on `sale_id`.
- **Operations** — _if Micro Stock Tracker add-on active_, decrements `products.stock_count` for each line item (or its variant). Emits `stock.low` if any drops below `safety_line`. Idempotent on `sale_id`.
- **Marketing** — updates the linked customer's derived metrics (`total_spend_myr += total_myr`, `last_purchase_at = paid_at`, `order_count += 1`). Only fires when `customer_id` is non-null. Idempotent on `sale_id`.
- **Admin** — appends to `audit_log` (action `sales.sale.completed`). Pushes a Notification Feed entry _"Sale {sale_number} · RM{total} · {cashier_name}"_ when total ≥ a configurable threshold (out of v1 scope; M2 just emits, listener is a no-op until Admin lands the threshold UI).

The `invoice.paid` event is **not** emitted by POS. `invoice.paid` is exclusively Finance's domain (when an owner marks a Finance invoice paid). POS sales travel on `sale.completed`; Finance's handler matrix subscribes to both, but the payload shape is intentionally different — POS payloads carry `cashier_user_id` and `sale_id`, invoice payloads carry `invoice_id` and `invoice_number`. The convergence happens inside Finance's transaction-row builder, not at the event layer.

#### 3.1.2 `sale.refunded` — emitted on refund creation

```ts
export interface SaleRefundedPayload {
  refund_id: string;
  refund_number: string;
  original_sale_id: string;
  original_sale_number: string;
  cashier_user_id: string;
  manager_approval_user_id: string | null;
  total_refund_myr: number;
  sst_refund_myr: number;
  refund_payment_method: "cash" | "duitnow_transfer";
  bank_reference: string | null;
  refunded_at: string;
  line_items: Array<{
    refund_item_id: string;
    original_sale_item_id: string;
    product_id: string | null;
    name_snapshot: string;
    qty_refunded: number;
    refund_line_total_myr: number;
    restocks: boolean;
  }>;
}
```

**Emitter:** `POST /api/sales/pos/refunds` (Sales) — same SQL transaction as `pos_refunds` insert.

**Consumers:**

- **Finance** — creates a counter-`transactions` row, type `EXPENSE` (or a `REVENUE` row with negative amount, depending on Finance's chosen reversal convention; the Finance plan picks; see D1 in §3.3), `category = 'Sales Refund'`, `linked_pos_refund_id`.
- **Operations** — for each `restocks=true` line item, increments `products.stock_count` back. Skips `restocks=false`. Idempotent on `refund_id`.
- **Marketing** — decrements customer derived metrics (`total_spend_myr -= total_refund_myr`, recalculates `aov`). Does NOT decrement `order_count` — the sale happened, even if it was reversed.
- **Admin** — `audit_log` entry, Notification Feed entry.

#### 3.1.3 `sale.voided` — emitted on same-day void (pre-closeout)

```ts
export interface SaleVoidedPayload {
  sale_id: string;
  sale_number: string;
  voided_by_user_id: string;
  void_reason: string;
  original_total_myr: number;
  payment_method: "cash" | "duitnow_qr_static" | "duitnow_qr_dynamic";
  voided_at: string;
}
```

**Emitter:** `POST /api/sales/pos/sales/[id]/void` (Sales).

**Consumers:**

- **Finance** — if the `sale.completed` event for the same `sale_id` has already been processed (the dispatcher may have run between sale creation and void), Finance reverses the original `transactions` row (or marks it `voided`); if not yet processed, Finance dedupes by `sale_id` and skips both. The handler reads its own `finance_event_dedup` table to know.
- **Operations** — same logic. If stock was decremented, increment back. If not yet processed, skip both.
- **Marketing** — if the customer-update handler fired, reverse. Else skip both.
- **Admin** — `audit_log` entry _always_ (irrespective of dedup state).

The race condition between `sale.completed` and `sale.voided` is the trickiest part of the contract. Solution: voids are only allowed when `pos_sales.close_out_id is null` AND `pos_sales.created_at > now() - interval '24 hours'` (enforced in the API route, not in SQL — see §8.1). In practice, the dispatcher runs faster than humans, so `sale.completed` will almost always be processed before a void. The reversal path in each consumer is the canonical path.

#### 3.1.4 `closeout.recorded` — emitted on daily close-out

```ts
export interface CloseoutRecordedPayload {
  close_out_id: string;
  business_id: string;
  close_out_date: string;
  closed_by_user_id: string;
  closed_at: string;
  sales_count: number;
  voids_count: number;
  refunds_count: number;
  expected_total_myr: number;
  actual_total_myr: number;
  total_variance_myr: number;
}
```

**Emitter:** `POST /api/sales/closeouts/[id]/close` (Sales).

**Consumers:**

- **Admin** — Notification Feed: _"Day closed · RM{total} · variance RM{var}"_. `audit_log` entry.
- **Finance** — no synchronous effect in v1. The Full Ledger Analytics Suite add-on will subscribe to this to produce daily summary rows. v1 plan: emit only; no listener yet.

### 3.1.5 Events Sales also emits (already in `lib/events/types.ts`)

- **`customer.created`** — emitted when a cashier adds a new customer via `POST /api/sales/pos/customer-upsert`. Payload `source: 'pos'`. Sales does NOT emit this from lead conversion (the convert flow creates the customer through the same `upsertFromPos.ts` wrapper, which emits with `source: 'lead_conversion'`).
- **`lead.converted`** — emitted on `POST /api/sales/leads/[id]/convert` when the linked POS sale completes. Payload `{ lead_id, customer_id, sale_id, converted_at }`. Marketing consumes for attribution metrics. Sales itself does NOT consume — the lead status flip happens inline in the conversion route, not via the event bus.
- **`lead.captured`** — emitted only when a lead arrives via a Marketing landing-page surface (not via the Sales-side `POST /api/sales/leads`). In v1, only Sales is a listener for `lead.captured`; the Sales listener creates a `leads` row. Sales does NOT emit `lead.captured` from its own UI — the inbound REST creates the row directly.

### 3.2 Events Sales consumes

| Event | Source | Sales handler | Action |
|-------|--------|---------------|--------|
| `lead.captured` | Marketing (external landing-page surface) | `lib/sales/handlers/onLeadCaptured.ts` | Inserts a `leads` row with `status='new'`, `channel` taken from payload, `assigned_user_id=null`. Idempotent on `payload.external_lead_id`. |
| `customer.merged` | Marketing (merge handler) | (no-op in Sales) | Marketing's merge handler walks `customer_external_refs` and runs the UPDATE itself; Sales does not subscribe. Sales only ensures its FK columns are registered (see §2.8). |

Sales is intentionally a thin consumer in v1 — only one inbound event. The architecture biases towards Sales as an emitter and Finance/Operations/Marketing as listeners, because Sales generates the source-of-truth domain events for revenue and customer activity.

### 3.3 Blocked-on (other dev's deliverables)

| ID | Blocks | Dependency |
|---|---|---|
| **D1** | M2 | Finance ships its `sale.completed` listener (`lib/finance/handlers/onSaleCompleted.ts`) that creates a `transactions` row. Sales' M2 cross-pillar integration test asserts the row appears. |
| **D2** | M2 (soft) | Operations ships its `sale.completed` listener (`lib/operations/handlers/onSaleCompleted.ts`) — only mandatory when Micro Stock Tracker add-on is in scope. v1 core ship can land M2 without it; flag in tests. |
| **D3** | M2 | Marketing ships `lib/marketing/upsertFromPos.ts` (already specified by `marketing-decisions.md` Q3+Q11). Sales calls this from `/api/sales/pos/customer-upsert`. |
| **D4** | M2 | Marketing ships `customer_external_refs` registry table (Q5). Sales' migration inserts its FK rows on top of this table — fails to apply if the registry doesn't exist. |
| **D5** | M2 | Marketing extends `customer.created.source` union with no new variants — Sales uses existing `pos`, `lead_conversion`. No work needed; cross-checking only. |
| **D6** | M3 | Operations ships `products` and `product_variants` with stable shape (id, sku, name, base_price, image_file_id, sst_applies). The POS grid query reads from these. M3 can mock with seed fixtures if Operations slips, but real cross-pillar tests need this. |
| **D7** | M3 | Marketing ships `GET /api/sales/pos/customer-search` and `POST /api/sales/pos/customer-upsert` endpoint contracts (Q11). Sales' M3 implements these endpoints inside Sales' API tree but routes the actual customer reads/writes through Marketing's `upsertFromPos.ts`. |
| **D8** | M5 (events listener test) | Phase 0 dispatcher (Admin) lands. Sales' M5 event-bus integration tests need a running dispatcher to assert listeners actually fire. Until then, Sales asserts on `events_outbox` row presence only. |
| **D9** | M4 | Finance lands the `sale.refunded` reversal handler. Without it the refund flow emits events that no one consumes. |
| **D10** | M1 | Phase 0 already shipped (`current_business_id()`, `current_role()`, `current_user_has_full_access()`). Confirmed in `00000000000001_rbac_helpers.sql`. No blocker. |

---

## 4. API Surface

All Sales routes live under `app/api/sales/`. Every route handler:

1. Calls `getCurrentUser()` (`lib/auth/current-user.ts`).
2. Calls `canSurface(role, 'sales', surface)` — fast-fail with 403 if false.
3. Validates the request body with a Zod schema.
4. Wraps mutations in a SQL transaction that writes both the entity and the `events_outbox` row.
5. Returns a typed JSON response.

RLS is the final defense — defense-in-depth, not the only check.

### 4.1 Route inventory

| Method | Path | Surface | Roles allowed | Side effects |
|--------|------|---------|---------------|--------------|
| `GET`  | `/api/sales/pos/products` | `pos` | cashier, owner, manager | none |
| `GET`  | `/api/sales/pos/customer-search` | `pos` | cashier, owner, manager | none (read via Marketing wrapper) |
| `POST` | `/api/sales/pos/customer-upsert` | `pos` | cashier, owner, manager | INSERT/UPDATE customers (via wrapper), emits `customer.created` if new |
| `POST` | `/api/sales/pos/quote` | `pos` | cashier, owner, manager | none (server-authoritative cart math echo) |
| `POST` | `/api/sales/pos/sales` | `pos` | cashier, owner, manager | INSERT pos_sales, pos_sale_items, events_outbox `sale.completed` |
| `POST` | `/api/sales/pos/sales/[id]/void` | `pos` | owner, manager (or cashier with manager PIN if business policy permits) | UPDATE pos_sales, events_outbox `sale.voided` |
| `POST` | `/api/sales/pos/sales/[id]/duitnow-qr` | `pos` | cashier, owner, manager | none (returns EMV string + PNG) |
| `POST` | `/api/sales/pos/refunds` | `pos` | owner, manager (or cashier with manager PIN above threshold) | INSERT pos_refunds, pos_refund_items, events_outbox `sale.refunded` |
| `GET`  | `/api/sales/sales` | `pos` | owner, manager, cashier (cashier scoped to today) | none |
| `GET`  | `/api/sales/sales/[id]` | `pos` | owner, manager, cashier | none |
| `GET`  | `/api/sales/refunds` | `pos` | owner, manager | none |
| `GET`  | `/api/sales/closeouts/today` | `pos` | owner, manager, cashier | none |
| `POST` | `/api/sales/closeouts` | `pos` | owner, manager | INSERT daily_close_outs row (status `open`) |
| `POST` | `/api/sales/closeouts/[id]/close` | `pos` | owner, manager | UPDATE daily_close_outs (status `closed`), UPDATE pos_sales.close_out_id, events_outbox `closeout.recorded` |
| `GET`  | `/api/sales/leads` | `leads` | owner, manager | none |
| `POST` | `/api/sales/leads` | `leads` | owner, manager | INSERT leads row |
| `GET`  | `/api/sales/leads/[id]` | `leads` | owner, manager | none |
| `PATCH` | `/api/sales/leads/[id]` | `leads` | owner, manager | UPDATE leads row |
| `POST` | `/api/sales/leads/[id]/notes` | `leads` | owner, manager | INSERT lead_notes row |
| `POST` | `/api/sales/leads/[id]/convert` | `leads` | owner, manager | INSERT pos_sales (status pending payment) + UPDATE leads (status `won`, converted_*), events_outbox `lead.converted` + `sale.completed` |

Note on the `pos` surface for cashiers: the matrix in `lib/permissions.ts` defines `cashier: { sales: { pos: 'rw' } }`. Every cashier-allowed route declares `surface: 'pos'` so `canSurface('cashier', 'sales', 'pos') === true`. Lead routes declare `surface: 'leads'`, blocking cashiers.

### 4.2 Schemas (Zod for request/response)

```ts
// lib/sales/schemas/posSale.ts
import { z } from "zod";

export const PosSaleItemInput = z.object({
  product_id: z.string().uuid().nullable(),
  product_variant_id: z.string().uuid().nullable(),
  name_snapshot: z.string().min(1).max(200),
  sku_snapshot: z.string().max(80).nullable(),
  qty: z.number().positive().max(99999),
  unit_price_myr: z.number().nonnegative().max(99999.99),
  sst_applies: z.boolean(),
});

export const PosSaleDiscountInput = z
  .object({
    discount_type: z.enum(["amount", "pct"]),
    discount_value: z.number().nonnegative(),
  })
  .nullable();

export const PosSaleCreateInput = z.object({
  customer_id: z.string().uuid().nullable(),
  lead_id: z.string().uuid().nullable(),
  items: z.array(PosSaleItemInput).min(1).max(50),
  discount: PosSaleDiscountInput,
  payment_method: z.enum(["cash", "duitnow_qr_static", "duitnow_qr_dynamic"]),
  payment_received_myr: z.number().nonnegative().nullable(),
  duitnow_reference: z.string().max(64).nullable(),
  manager_pin: z.string().regex(/^\d{4,8}$/).nullable(),
});

export type PosSaleCreate = z.infer<typeof PosSaleCreateInput>;

export const PosSaleResponse = z.object({
  sale_id: z.string().uuid(),
  sale_number: z.string(),
  subtotal_myr: z.number(),
  discount_amount_myr: z.number(),
  sst_amount_myr: z.number(),
  rounding_adjustment_myr: z.number(),
  total_myr: z.number(),
  change_myr: z.number(),
  receipt_url: z.string(),
});
```

```ts
// lib/sales/schemas/refund.ts
export const RefundItemInput = z.object({
  original_sale_item_id: z.string().uuid(),
  qty_refunded: z.number().positive(),
  restocks: z.boolean(),
});

export const RefundCreateInput = z.object({
  original_sale_id: z.string().uuid(),
  refund_type: z.enum(["full", "partial"]),
  items: z.array(RefundItemInput).min(1),
  refund_payment_method: z.enum(["cash", "duitnow_transfer"]),
  bank_reference: z.string().max(64).nullable(),
  reason: z.string().min(3).max(500),
  manager_pin: z.string().regex(/^\d{4,8}$/).nullable(),
});
```

```ts
// lib/sales/schemas/lead.ts
export const LeadChannel = z.enum([
  "whatsapp", "instagram", "tiktok", "facebook",
  "walk_in", "referral", "web_form", "other",
]);

export const LeadStatus = z.enum([
  "new", "qualified", "contacted", "negotiating", "won", "lost",
]);

export const LeadCreateInput = z.object({
  name: z.string().min(1).max(120),
  phone_e164: z.string().regex(/^\+\d{8,15}$/).nullable(),
  channel: LeadChannel,
  interest: z.string().max(500).nullable(),
  value_estimate_myr: z.number().nonnegative().nullable(),
  assigned_user_id: z.string().uuid().nullable(),
});

export const LeadPatchInput = LeadCreateInput.partial().extend({
  status: LeadStatus.optional(),
  lost_reason: z.string().max(500).nullable().optional(),
  last_contacted_at: z.string().datetime().nullable().optional(),
});

export const LeadConvertInput = z.object({
  items: z.array(PosSaleItemInput).min(1),
  discount: PosSaleDiscountInput,
  payment_method: z.enum(["cash", "duitnow_qr_static", "duitnow_qr_dynamic"]),
  payment_received_myr: z.number().nonnegative().nullable(),
});
```

```ts
// lib/sales/schemas/closeout.ts
export const CloseoutCloseInput = z.object({
  actual_cash_myr: z.number().nonnegative(),
  actual_duitnow_myr: z.number().nonnegative(),
  notes: z.string().max(1000).nullable(),
});
```

```ts
// lib/sales/schemas/customer.ts (POS-facing wrapper schemas — actual writes
// go through lib/marketing/upsertFromPos.ts)
export const CustomerSearchQuery = z.object({
  q: z.string().min(2).max(60),
  limit: z.number().int().min(1).max(20).default(10),
});

export const CustomerUpsertInput = z.object({
  name: z.string().min(1).max(120),
  phone_e164: z.string().regex(/^\+\d{8,15}$/),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});
```

### 4.3 Mutations that write to `events_outbox`

Every mutation writes to `events_outbox` inside the **same** SQL transaction as the source entity write. The reference pattern (M1 ships `app/api/sales/pos/sales/route.ts` on this skeleton):

```ts
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canSurface(user.role, "sales", "pos")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = PosSaleCreateInput.parse(await req.json());
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("sst_enabled, sst_rate_pct")
    .eq("id", user.businessId)
    .single();
  if (!business) return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  const totals = computeCart({
    items: body.items,
    discount: body.discount,
    sst_enabled: business.sst_enabled,
    sst_rate_pct: Number(business.sst_rate_pct),
    payment_method: body.payment_method,
  });
  const { data, error } = await supabase.rpc("create_pos_sale", {
    p_business_id: user.businessId,
    p_cashier_user_id: user.userId,
    p_input: body,
    p_totals: totals,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
```

The Postgres function `create_pos_sale` is the transactional core. Skeleton (full function ships in M1's migration):

```sql
create or replace function public.create_pos_sale(
  p_business_id     uuid,
  p_cashier_user_id uuid,
  p_input           jsonb,
  p_totals          jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sale_id     uuid := gen_random_uuid();
  v_sale_number text  := public.next_sale_number(p_business_id, 'sale');
begin
  insert into public.pos_sales (id, business_id, sale_number, cashier_user_id, ...)
    values (v_sale_id, p_business_id, v_sale_number, p_cashier_user_id, ...);

  insert into public.pos_sale_items (sale_id, business_id, ...)
    select v_sale_id, p_business_id, ... from jsonb_array_elements(p_totals->'items');

  insert into public.events_outbox (business_id, name, payload, emitted_by_user_id)
    values (p_business_id, 'sale.completed',
            jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number,
              'total_myr', p_totals->>'total_myr', /* … full SaleCompletedPayload … */),
            p_cashier_user_id);

  return jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number,
                            'total_myr', p_totals->>'total_myr');
end;
$$;
```

Mirror functions exist for `create_pos_refund`, `void_pos_sale`, `close_daily_closeout`, `convert_lead_to_sale`. Each writes its source row(s) + the corresponding `events_outbox` row in one transaction.

---

## 5. UI Surfaces

### 5.1 Route inventory (desktop + mobile)

| Route | Mode | Primary | Component |
|-------|------|---------|-----------|
| `/sales` | both | desktop | `SalesOverviewPage` — today's sales total, lead count by status, open close-out chip |
| `/sales/pos` | mobile | mobile | `PosPage` — full-screen product grid + cart |
| `/sales/sales` | both | desktop | `SalesListPage` — paginated list, filter by date/cashier/method |
| `/sales/sales/[id]` | both | both | `SaleDetailPage` — receipt view, void button, refund button |
| `/sales/refunds` | desktop | desktop | `RefundListPage` |
| `/sales/closeout` | both | desktop | `CloseoutPage` — today's expected vs actual, close button |
| `/sales/leads` | both | both | `LeadBoardPage` — Kanban (mobile is single-column scrolling) |
| `/sales/leads/[id]` | both | both | `LeadDetailPage` — fields, notes timeline, status flow buttons |
| `/sales/pipeline` | desktop | desktop | `PipelineBoardPage` — full-width 6-column desktop Kanban (alias of `/sales/leads` with wider canvas) |

Mobile primary surface is `/sales/pos`. Desktop primary surface is `/sales/leads` (+ `/sales/closeout`). `AdaptiveShell` selects the correct sub-shell based on viewport.

### 5.2 Component inventory

```
components/sales/
├── pos/
│   ├── ProductGrid.tsx           — 4-column on phones, 6-column on tablets
│   ├── ProductTile.tsx            — base SKU tile (tap expands variants)
│   ├── VariantSheet.tsx           — bottom sheet of variant chips
│   ├── Cart.tsx                   — line list + totals row + buttons
│   ├── CartLine.tsx               — name, qty stepper, line total
│   ├── DiscountModal.tsx          — RM-or-% toggle, manager PIN field
│   ├── CustomerAttachSheet.tsx    — search-as-you-type + "+ Add new"
│   ├── PaymentSheet.tsx           — Cash | Static QR | Dynamic QR tabs
│   ├── DuitNowQrModal.tsx         — fullscreen QR + reference + Mark Received
│   ├── CashTender.tsx             — payment_received keypad + change display
│   ├── ReceiptView.tsx            — printable receipt (CSS print stylesheet)
│   └── ManagerPinPrompt.tsx       — 4–8 digit numeric pad
├── refunds/
│   ├── RefundForm.tsx             — line-by-line qty refund + restock toggle
│   └── RefundList.tsx
├── voids/
│   └── VoidConfirm.tsx            — reason textarea + manager PIN if required
├── closeout/
│   ├── CloseoutSummary.tsx        — expected/actual side-by-side
│   └── VarianceWarning.tsx
├── sales/
│   ├── SaleList.tsx
│   └── SaleDetail.tsx
└── leads/
    ├── LeadBoard.tsx              — drag-and-drop columns
    ├── LeadColumn.tsx              — one status column
    ├── LeadCard.tsx                — name, channel, value chip, last_contacted age
    ├── LeadDetailDrawer.tsx        — slide-in on desktop, fullpage on mobile
    ├── LeadStatusFlow.tsx          — status arrow buttons (NEW → QUAL → CONT → NEG → WON|LOST)
    ├── LeadNotesTimeline.tsx
    └── ConvertToSaleModal.tsx      — preview cart from lead.interest line items
```

Brand application:

- Buttons / accents: `accent-500` (logo orange) for the primary "Pay" CTA, "Convert to Sale" CTA, and "Close Day" CTA.
- Brand: `brand-500` (logo blue) for the POS top bar, pipeline header.
- Page background: `cream-100`.
- Body text: `ink`.
- Status chips: `status-success` (WON, completed), `status-warning` (negotiating, refunded), `status-danger` (lost, voided, variance > 0).

### 5.3 States per surface

| Surface | Empty | Loading | Error | Pending action |
|---------|-------|---------|-------|----------------|
| `PosPage` — product grid | "No products yet. Ask the owner to add stock in Operations → Products." | Skeleton 4×6 grid of tiles | Toast "Couldn't load products — pull to refresh" | n/a |
| `PosPage` — cart | "Tap a tile to start a sale" placeholder | n/a | n/a | Disabled "Pay" button until ≥ 1 item |
| `PaymentSheet` — dynamic QR | n/a | "Generating QR…" with spinner | "QR couldn't generate — check DuitNow ID in Settings" | "Mark Received" disabled until cashier taps "Customer scanned" |
| `RefundForm` | n/a | n/a | Inline field error per line if qty exceeds remaining refundable | Disabled submit until ≥ 1 line + reason |
| `CloseoutPage` | "No sales today" with "Skip close-out for today" button | n/a | n/a | Disabled close button if any sale in last 60 s (race window) |
| `LeadBoardPage` | "No leads yet. Tap + to add your first lead." | Per-column skeleton | Toast on save fail | Disabled status arrows on terminal states |
| `LeadDetailPage` | n/a | Field skeleton | Inline error per field | "Convert to Sale" disabled when status ≠ NEGOTIATING and ≠ QUALIFIED |
| `SaleDetail` — voided | Receipt rendered with red "VOIDED" stamp; refund button hidden | n/a | n/a | n/a |
| `SaleDetail` — refunded | Receipt rendered with amber "PARTIALLY REFUNDED" or red "FULLY REFUNDED" chip | n/a | n/a | Refund button hidden when fully refunded |

### 5.4 Existing scaffold gap

The current scaffold ships:

- `app/(app)/sales/page.tsx` — pillar stub
- `app/(app)/sales/pos/page.tsx` — pillar stub
- `app/(app)/sales/leads/page.tsx` — pillar stub
- `lib/pillars/index.ts` — Sales has 2 surfaces declared: `/sales/pos` (mobile primary) and `/sales/leads` (both)

Missing (M1 + M3 deliverables):

- All component files under `components/sales/`
- `app/(app)/sales/pipeline/page.tsx` (desktop wide Kanban)
- `app/(app)/sales/sales/page.tsx` and `app/(app)/sales/sales/[id]/page.tsx`
- `app/(app)/sales/refunds/page.tsx`
- `app/(app)/sales/closeout/page.tsx`
- `app/(app)/sales/leads/[id]/page.tsx`
- Surface entries in `lib/pillars/index.ts` for `closeout`, `refunds`, `pipeline`, `sales` (history list) — Sales' M5 PR amends this list.

`lib/pillars/index.ts` final shape after M5:

```ts
sales: {
  id: "sales",
  label: "Sales",
  short: "Sales",
  href: "/sales",
  description: "Track leads and take payment at the counter.",
  surfaces: [
    { href: "/sales/pos",       label: "POS",        primary: "mobile" },
    { href: "/sales/leads",     label: "Leads",      primary: "both" },
    { href: "/sales/pipeline",  label: "Pipeline",   primary: "desktop" },
    { href: "/sales/sales",     label: "Sales",      primary: "desktop" },
    { href: "/sales/refunds",   label: "Refunds",    primary: "desktop" },
    { href: "/sales/closeout",  label: "Close-out",  primary: "desktop" },
  ],
},
```

---

## 6. POS Cart & SST Logic

### 6.1 Line-level + order-level discounts

Decision: **order-level discount only in v1**. Cashiers cannot discount individual lines. Rationale:

- Most micro-SME POS use cases want one-knob discount ("RM 5 off this whole sale" or "10% off").
- Line-level discounts add a permissions surface (per-line manager approval), a math layer (apportioning SST per line), and a UI affordance the 5-second goal can't accommodate.
- The internal math still distributes the order-level discount per line proportionally (see §6.4) so receipts show the discount on the line that carries it for SST accuracy.

Discount thresholds:

- **Auto-approved (no manager PIN):** discount ≤ RM 5 OR ≤ 5% of subtotal.
- **Manager PIN required:** discount > RM 5 AND > 5% of subtotal (whichever is exceeded).
- Owner can disable the PIN gate entirely via `businesses.discount_pin_required` (added in the Sales migration as a column on `businesses`, defaulting `true`).

Manager PIN storage: `businesses.manager_pin_hash` (bcrypt, set via Settings UI by the owner). Cashier-entered PIN is bcrypt-compared at the API route; the plaintext PIN is never logged.

### 6.2 SST registration toggle + per-product SST flag

Two-level gate:

1. **Business-level:** `businesses.sst_enabled` (boolean) and `businesses.sst_rate_pct` (numeric, e.g. `6.00`). Mirrors Finance's invoice SST behaviour.
2. **Per-product:** `products.sst_applies` (boolean) — added by Operations' migration (verify with Operations dev; if Operations defaults all products to `sst_applies = sst_enabled` at insert time, Sales doesn't need to ask, just reads). If Operations does not ship this column, Sales' M1 plan adds an inline column on `pos_sale_items.sst_applies` only and assumes _all products_ are SST-eligible when `sst_enabled = true`. Open question for Operations — see §12.

Effective behaviour:

- `sst_enabled = false` (business-wide) → no SST line anywhere; receipt shows `Subtotal · Total`.
- `sst_enabled = true` AND `sst_applies = true` on a line → that line contributes to `sst_amount_myr`.
- `sst_enabled = true` AND `sst_applies = false` (e.g. zero-rated basic goods) → that line is shown in subtotal but excluded from SST calculation.
- The receipt always shows `Subtotal · SST {rate%} · Total` when at least one line was SST-applicable.

### 6.3 Rounding rules

Two distinct rounding layers:

1. **Line-level math:** all intermediate values are computed in `numeric(12, 2)` (cents). No floats. Each line's `sst_amount_myr` is rounded to 2 decimal places using bankers' rounding (`ROUND_HALF_EVEN`).
2. **Grand-total 5-sen rounding (Malaysia BNM rule):** the final `total_myr` is rounded to the nearest 5 sen for **cash** payments only. DuitNow payments use the exact amount (no rounding). The delta is captured in `pos_sales.rounding_adjustment_myr` (positive or negative, ≤ ±0.02).

Algorithm (Bank Negara 5-sen rounding):

```
let exact = subtotal + sst - discount;  // in cents
let last_digit = exact % 5;
let rounded;
switch (last_digit) {
  case 0:                rounded = exact;          break;  // .00, .05
  case 1: case 2:        rounded = exact - last_digit;     // .01, .02 → .00
  case 3: case 4:        rounded = exact - last_digit + 5; // .03, .04 → .05
}
rounding_adjustment = rounded - exact;
```

For cash only. DuitNow QR (static and dynamic) uses `exact` and zero adjustment.

### 6.4 Pseudo-code

`lib/sales/cart.ts` — server-authoritative cart computation. The client mirrors this for instant feedback; the server recomputes for trust.

```ts
import type { z } from "zod";
import type { PosSaleItemInput, PosSaleDiscountInput } from "./schemas/posSale";
import { roundHalfEven, fiveSenRound } from "./rounding";

export interface CartInput {
  items: Array<z.infer<typeof PosSaleItemInput>>;
  discount: z.infer<typeof PosSaleDiscountInput>;
  sst_enabled: boolean;
  sst_rate_pct: number;
  payment_method: "cash" | "duitnow_qr_static" | "duitnow_qr_dynamic";
  payment_received_myr?: number | null;
}

export function computeCart(input: CartInput) {
  const lineSubs = input.items.map((it) =>
    roundHalfEven(it.qty * it.unit_price_myr, 2),
  );
  const gross = lineSubs.reduce((a, b) => a + b, 0);

  let discount = 0;
  if (input.discount) {
    discount = input.discount.discount_type === "amount"
      ? Math.min(input.discount.discount_value, gross)
      : roundHalfEven(gross * (input.discount.discount_value / 100), 2);
  }

  // Apportion discount per line so SST math is line-accurate.
  const portions = lineSubs.map((sub) =>
    gross === 0 ? 0 : roundHalfEven((sub / gross) * discount, 2),
  );
  const drift = discount - portions.reduce((a, b) => a + b, 0);
  if (portions.length > 0) portions[portions.length - 1] += drift;

  const lines = input.items.map((it, i) => {
    const lineDisc = portions[i];
    const taxable = lineSubs[i] - lineDisc;
    const sst = input.sst_enabled && it.sst_applies
      ? roundHalfEven(taxable * (input.sst_rate_pct / 100), 2)
      : 0;
    return {
      ...it,
      position: i + 1,
      line_subtotal_myr: lineSubs[i],
      line_discount_myr: lineDisc,
      sst_amount_myr: sst,
      line_total_myr: taxable + sst,
    };
  });

  const sstTotal = lines.reduce((a, l) => a + l.sst_amount_myr, 0);
  const exact = gross - discount + sstTotal;
  const isCash = input.payment_method === "cash";
  const total = isCash ? fiveSenRound(exact) : exact;
  const adj = total - exact;
  const change =
    isCash && input.payment_received_myr != null
      ? Math.max(0, roundHalfEven(input.payment_received_myr - total, 2))
      : 0;

  return {
    items: lines,
    subtotal_myr: roundHalfEven(gross, 2),
    discount_amount_myr: roundHalfEven(discount, 2),
    sst_amount_myr: roundHalfEven(sstTotal, 2),
    rounding_adjustment_myr: roundHalfEven(adj, 2),
    total_myr: roundHalfEven(total, 2),
    change_myr: change,
  };
}
```

`lib/sales/rounding.ts`:

```ts
export function roundHalfEven(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const x = value * factor;
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return (floor + 1) / factor;
  if (diff < 0.5) return floor / factor;
  return ((floor % 2 === 0 ? floor : floor + 1)) / factor;
}

export function fiveSenRound(value: number): number {
  const cents = Math.round(value * 100);
  const mod = cents % 5;
  const rounded = mod === 0 ? cents : mod <= 2 ? cents - mod : cents - mod + 5;
  return rounded / 100;
}
```

`lib/sales/saleNumber.ts` calls a Postgres `acquire_sale_number(business_id, kind, year)` function that uses `INSERT … ON CONFLICT DO UPDATE … RETURNING last_n` against `pos_sale_counters` to atomically increment under row lock. Format: `POS-{YYYY}-{NNNNNN}` (or `RFD-`).

---

## 7. DuitNow Dynamic QR

### 7.1 EMVCo TLV string assembly

DuitNow QR is built on the **EMVCo Merchant Presented Mode QR Code Specification v1.1**. The QR payload is a series of TLV (Tag-Length-Value) data objects with 2-digit numeric tags, 2-digit numeric length, and a value of that exact length. The final field is a CRC-16/CCITT-FALSE of all preceding bytes.

Field map for a DuitNow Dynamic Per-Amount QR:

| Tag | Length | Description | Sample value |
|----|--------|-------------|--------------|
| 00 | 02 | Payload Format Indicator | `01` |
| 01 | 02 | Point of Initiation Method | `12` (dynamic) |
| 26 | nn | Merchant Account Information (DuitNow template) | nested |
| └ 00 | nn | Globally Unique Identifier | `MY.PAYNET.MERCHANT` (or PayNet-assigned GUID — see §7.4 caveat) |
| └ 01 | nn | Merchant DuitNow ID | e.g. `60123456789` |
| └ 02 | nn | Merchant DuitNow ID type | `02` (mobile) / `03` (NRIC) / `04` (passport) / `05` (SSM business reg) |
| 52 | 04 | Merchant Category Code (MCC) | `5812` (e.g. eating place) — owner-configurable in v1.5; default `0000` if unset |
| 53 | 03 | Transaction Currency | `458` (MYR, ISO 4217 numeric) |
| 54 | nn | Transaction Amount | e.g. `12.50` |
| 58 | 02 | Country Code | `MY` |
| 59 | nn | Merchant Name | e.g. `INTAN TRADE` |
| 60 | nn | Merchant City | e.g. `KUALA LUMPUR` |
| 62 | nn | Additional Data Field Template | nested |
| └ 05 | nn | Reference Label | sale number `POS-2026-000123` |
| 63 | 04 | CRC | `XXXX` (computed over preceding bytes including `6304`) |

`lib/sales/duitnow.ts`:

```ts
import { crc16ccitt } from "./crc16";

export interface DuitNowDynamicInput {
  duitnowId: string;
  duitnowIdType: "02" | "03" | "04" | "05";
  merchantName: string;
  merchantCity: string;
  amountMyr: number;
  reference: string;
  mcc?: string;
}

const DUITNOW_GUID = "MY.PAYNET.MERCHANT";
const CURRENCY_MYR = "458";
const COUNTRY_MY = "MY";

function tlv(tag: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`TLV value too long for tag ${tag}: ${value.length}`);
  }
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

function buildMerchantAccountInfo(input: DuitNowDynamicInput): string {
  const sub00 = tlv("00", DUITNOW_GUID);
  const sub01 = tlv("01", input.duitnowId);
  const sub02 = tlv("02", input.duitnowIdType);
  return sub00 + sub01 + sub02;
}

function buildAdditionalDataField(input: DuitNowDynamicInput): string {
  return tlv("05", input.reference);
}

export function buildDuitNowDynamicPayload(input: DuitNowDynamicInput): string {
  const payloadFormat = tlv("00", "01");
  const initiationMethod = tlv("01", "12");
  const merchantAccount = tlv("26", buildMerchantAccountInfo(input));
  const mcc = tlv("52", input.mcc ?? "0000");
  const currency = tlv("53", CURRENCY_MYR);
  const amount = tlv("54", input.amountMyr.toFixed(2));
  const country = tlv("58", COUNTRY_MY);
  const merchantName = tlv("59", input.merchantName.slice(0, 25));
  const merchantCity = tlv("60", input.merchantCity.slice(0, 15));
  const additional = tlv("62", buildAdditionalDataField(input));

  const beforeCrc =
    payloadFormat +
    initiationMethod +
    merchantAccount +
    mcc +
    currency +
    amount +
    country +
    merchantName +
    merchantCity +
    additional +
    "6304";

  const crc = crc16ccitt(beforeCrc).toString(16).toUpperCase().padStart(4, "0");
  return beforeCrc + crc;
}
```

`lib/sales/crc16.ts`:

```ts
export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
```

### 7.2 Per-business DuitNow ID setup

Schema additions on `businesses` (Sales migration, since it owns the POS surface):

```sql
alter table public.businesses
  add column if not exists duitnow_id_type text
    check (duitnow_id_type in ('02', '03', '04', '05')),
  add column if not exists duitnow_merchant_name text,
  add column if not exists duitnow_merchant_city text,
  add column if not exists duitnow_mcc text default '0000',
  add column if not exists discount_pin_required boolean not null default true,
  add column if not exists manager_pin_hash text;
```

`duitnow_id` already exists from `00000000000000_init.sql`. The Sales migration adds the four sibling fields needed to render an EMVCo-compliant QR.

Settings UI (owner-only, lives under `/admin/settings` — Admin pillar's responsibility, but Sales' M4 contributes the form section): four required fields (ID, ID type, merchant name, merchant city) and one optional (MCC).

When a cashier hits `POST /api/sales/pos/sales/[id]/duitnow-qr` with dynamic mode selected and any of those four are null, the route returns `409 Conflict` with `error_code: 'duitnow_not_configured'`. The mobile POS surface UI swaps the dynamic-QR tab for an inline "Setup DuitNow in Settings" prompt when this fires.

### 7.3 QR rendering + reference number

Flow:

1. Cashier taps **Dynamic DuitNow QR** in `PaymentSheet`.
2. Mobile client `POST /api/sales/pos/sales/[id]/duitnow-qr` with `{ amount_myr, reference }`. Reference is the (about-to-be-issued) sale number, generated server-side via `next_sale_number()` _before_ the sale row is committed. The sale isn't actually created until the cashier confirms payment received, so the reference is reserved (via an `INSERT` on `pos_sale_counters` that bumps `last_n`).
3. Server returns `{ emv_string, qr_png_base64, reference }`.
4. Client renders the QR fullscreen (`DuitNowQrModal`).
5. Customer scans, pays via banking app.
6. Cashier taps **Mark Received** → client `POST /api/sales/pos/sales` with `payment_method: 'duitnow_qr_dynamic'`, `duitnow_reference: <reserved-sale-number>`. The server commits the sale using the already-reserved sale number (idempotent on `(business_id, sale_number)`).

The reference is the sale number itself. No separate reference field. Bank statement reconciliation: owner sees "POS-2026-000123" in their DuitNow Transfer history and matches against `/sales/sales` list.

### 7.4 Library choice (`qrcode`)

`qrcode` is **not** in `package.json` today (confirmed). M4 adds it:

```bash
npm install qrcode
npm install -D @types/qrcode
```

Latest stable major as of 2026-06 — pin via `npm install` at PR time. Lightweight (~50 KB), no transitive bloat, has both Node and browser builds. Server-side render to PNG base64 in the route, send to client. (Alternative is `qr-code-styling` for fancier output, but it's heavier and unnecessary for the POS screen.)

Caveats flagged:

- The exact `MY.PAYNET.MERCHANT` GUID under tag 26→00 must be verified against the PayNet DuitNow QR Implementation Guide. The string used in the sketch above is the public convention; production code must pin against the official PayNet spec doc before going live (see §12.8).
- MCC `0000` is a fallback. PayNet validators may reject this; owner-configurable MCC dropdown is a Sales v1.1 deliverable.

---

## 8. Refunds & Voids

### 8.1 Refund vs Void distinction

| Distinction | Void | Refund |
|-------------|------|--------|
| When | Same business day, before daily close-out, sale ≤ 24h old | Any time after sale (within tax-period retention) |
| Mechanism | Status flip on original `pos_sales` row (`status='voided'`) | New `pos_refunds` row referencing original sale |
| Ledger effect | Finance reverses the original `transactions` row (or marks `voided`) | Finance posts a new counter-`transactions` row, type `EXPENSE`, category `Sales Refund` |
| Stock effect | Operations increments stock back (full quantity, every line) | Operations increments only for lines where `restocks=true` |
| Customer-facing | Original receipt is annulled | A "credit note" receipt is generated alongside the original |
| Customer metrics | `total_spend` and `last_purchase_at` reverted | `total_spend` decremented; `order_count` unchanged |
| Allowed by | Owner, Manager (or Cashier with manager PIN if business policy permits) | Owner, Manager (or Cashier with manager PIN above threshold) |
| Auditable | Yes — `voided_at`, `voided_by_user_id`, `void_reason` columns | Yes — full `pos_refunds` row + `pos_refund_items` |

API enforcement:

- `POST /api/sales/pos/sales/[id]/void` returns `409 Conflict` if any of:
  - `pos_sales.status != 'completed'`
  - `pos_sales.close_out_id is not null`
  - `pos_sales.created_at < now() - interval '24 hours'`

  In those cases the UI prompts the cashier to use the refund flow instead.

### 8.2 Approval thresholds

```ts
// lib/sales/refundRules.ts
export const REFUND_AUTO_APPROVE_LIMIT_MYR = 100;
export const VOID_AUTO_APPROVE_LIMIT_MYR = 200;
export const DISCOUNT_AUTO_APPROVE_AMOUNT_MYR = 5;
export const DISCOUNT_AUTO_APPROVE_PCT = 5;

export function refundRequiresManager(opts: {
  totalRefundMyr: number;
  cashierRole: "cashier" | "manager" | "owner";
  businessPinRequired: boolean;
}): boolean {
  if (opts.cashierRole !== "cashier") return false;
  if (!opts.businessPinRequired) return false;
  return opts.totalRefundMyr > REFUND_AUTO_APPROVE_LIMIT_MYR;
}

export function voidRequiresManager(opts: {
  totalMyr: number;
  cashierRole: "cashier" | "manager" | "owner";
  businessPinRequired: boolean;
}): boolean {
  if (opts.cashierRole !== "cashier") return false;
  if (!opts.businessPinRequired) return false;
  return opts.totalMyr > VOID_AUTO_APPROVE_LIMIT_MYR;
}

export function discountRequiresManager(opts: {
  subtotalMyr: number;
  discountType: "amount" | "pct";
  discountValue: number;
  businessPinRequired: boolean;
}): boolean {
  if (!opts.businessPinRequired) return false;
  if (opts.discountType === "amount") {
    return opts.discountValue > DISCOUNT_AUTO_APPROVE_AMOUNT_MYR;
  }
  return opts.discountValue > DISCOUNT_AUTO_APPROVE_PCT;
}
```

API routes call these helpers. If `manager_pin` is absent in the request body and the helper returns `true`, return `403` with `error_code: 'manager_pin_required'`. If `manager_pin` is present, bcrypt-compare against `businesses.manager_pin_hash`. On mismatch return `403` with `error_code: 'invalid_manager_pin'`. On match, set `pos_refunds.manager_approval_user_id` (or `pos_sales.manager_approval_user_id`) to the owner/manager user whose PIN it was — resolution is keyed by hash so this is logically `business.owner_user_id` for v1 single-PIN setup. Multi-manager PIN is a v2 add-on.

Rate limiting: 5 wrong PIN attempts per 60s per business locks PIN for 5 minutes (in-memory; v2 hardens with Redis when multi-instance ships).

### 8.3 Cross-pillar effects

| Effect | Where | Trigger |
|--------|-------|---------|
| Finance credit-note `transactions` row | Finance pillar | `sale.refunded` listener |
| Operations stock increment | Operations pillar (only if Micro Stock Tracker add-on active) | `sale.refunded` listener, iterating `line_items[]` with `restocks=true` |
| Marketing customer metric reversal | Marketing pillar | `sale.refunded` listener |
| Admin audit log row | Admin pillar | `sale.refunded` listener (and `sale.voided`) |
| Notification Feed entry | Admin pillar | `sale.refunded`, `sale.voided` listeners |

All four happen inside the dispatcher's transaction (sync handlers). Refund route returns `200 OK` once the SQL transaction commits; the dispatcher then fans out to the consumers. If a sync handler fails (e.g. Operations stock underflow because product was deleted), the whole refund rolls back. The cashier sees an inline error and can retry without `restocks=true`.

---

## 9. Permissions

### 9.1 Per-surface mapping against `lib/permissions.ts`

`lib/permissions.ts` exports `permissions[role].sales` for each role. The current matrix:

| Role | `sales` value |
|------|----|
| `owner` | `"*"` |
| `manager` | `"*"` |
| `accountant` | `undefined` |
| `hr_officer` | `undefined` |
| `cashier` | `{ pos: "rw" }` |
| `staff` | `undefined` |

Sales' API guards call `canSurface(role, 'sales', surface)` for one of three values: `"pos"`, `"leads"`, `"closeout"`. The matrix above already covers `"pos"` for cashier. Sales' M3 PR amends `lib/permissions.ts` to add `"leads"` and `"closeout"` surfaces to owner/manager — Owner/Manager `"*"` already grants both (per `canSurface`'s `"*"` short-circuit), so no actual code change is needed. The change is a comment/documentation update inside `lib/permissions.ts` listing what surfaces Sales now exposes (for readability when auditing the matrix).

### 9.2 Surface × role matrix

| Surface | owner | manager | accountant | hr_officer | cashier | staff |
|---------|-------|---------|------------|------------|---------|-------|
| `/sales` (overview) | rw | rw | — | — | r (POS quick-link only) | — |
| `/sales/pos` | rw | rw | — | — | rw | — |
| `/sales/sales` (history) | rw | rw | — | — | r (today only) | — |
| `/sales/sales/[id]` | rw | rw | — | — | r (today only) | — |
| `/sales/refunds` | rw | rw | — | — | — | — |
| `/sales/closeout` | rw | rw | — | — | — | — |
| `/sales/leads` | rw | rw | — | — | — | — |
| `/sales/leads/[id]` | rw | rw | — | — | — | — |
| `/sales/pipeline` | rw | rw | — | — | — | — |

"Cashier (today only)" is enforced at the API route level by adding `.gte("created_at", startOfBusinessDay(businessId))` when `role === 'cashier'`. Not enforced in RLS — RLS would have to compute "today" per business, which is brittle. The route-layer filter + the broad RLS policy (any sale in own business) is the chosen split.

### 9.3 RLS posture

Three patterns repeated across Sales tables:

**Pattern A — SELECT, tenant-scoped (everyone in the business with read on Sales can SELECT):**

```sql
create policy "<table>_select_self_business"
  on public.<table>
  for select
  using (business_id = public.current_business_id());
```

Applied to `pos_sales`, `pos_sale_items`, `pos_refunds`, `pos_refund_items`, `daily_close_outs`, `leads`, `lead_notes`. The matrix at the API layer is what gates cashiers out of leads.

**Pattern B — INSERT/UPDATE, cashier-or-full for POS-writable tables:**

```sql
create policy "<table>_write_pos"
  on public.<table>
  for insert
  with check (
    business_id = public.current_business_id()
    and (
      public.current_user_has_full_access('sales')
      or public.current_role() = 'cashier'
    )
  );
```

Applied to `pos_sales`, `pos_sale_items`, `pos_sale_counters`. This is the only RLS deviation from the Operations/Marketing patterns — cashier writes are explicitly permitted on these three tables.

**Pattern C — INSERT/UPDATE, full-access only:**

```sql
create policy "<table>_write_full_access"
  on public.<table>
  for insert
  with check (
    business_id = public.current_business_id()
    and public.current_user_has_full_access('sales')
  );
```

Applied to `pos_refunds`, `pos_refund_items`, `daily_close_outs`, `leads`, `lead_notes`. Cashier-initiated refunds above the auto-approval threshold go through a service-role bypass (see §8.2) — the bypass is the only write path for cashier-initiated refunds, and it ALWAYS sets `manager_approval_user_id` to the manager whose PIN was validated, so the audit trail is intact.

`pos_sales` UPDATE (for voids) uses Pattern B because voids may be initiated by a cashier when the business config allows. The route-layer auto-approval check is the actual policy enforcement.

---

## 10. Testing Strategy

### 10.1 Unit tests

Located under `tests/sales/unit/`. Run via `vitest`. No DB, no HTTP.

| Test file | Coverage |
|-----------|----------|
| `cart.test.ts` | Empty cart → totals zero. Single line. Multiple lines. Amount discount. Pct discount. Discount exceeds subtotal (clamped). SST disabled. SST enabled with mixed `sst_applies` per line. Cash payment 5-sen rounding (.01, .02, .03, .04, .05, .06). DuitNow payment no rounding. Change calculation. Discount per-line apportionment drift cap. |
| `rounding.test.ts` | `roundHalfEven` on edge cases (.5 → even, negative numbers). `fiveSenRound` on each of the five residues. |
| `duitnow.test.ts` | EMV TLV string builder produces the expected static fixture for a known input. CRC-16 matches PayNet sample QR (test vectors from spec). Reference-label tag (62→05) encodes correctly. Long merchant names truncated to 25 chars. |
| `crc16.test.ts` | CCITT-FALSE matches known test vectors (`123456789` → `0x29B1`). |
| `refundRules.test.ts` | All four combinations of role × pin-required for `refundRequiresManager`. Discount thresholds boundary. |
| `saleNumber.test.ts` | (with DB mock) Sequential increment per business per year. Year rollover. Concurrent acquire returns distinct numbers. |
| `qualifyTransitions.test.ts` | Legal status transitions on `leads`. WON is terminal except by sale-void cascade. |

### 10.2 RLS tests

Located under `tests/sales/rls/`. Use the Supabase local harness (started by `npm run supabase:start`); the harness comes online in M1 alongside Marketing's M1 plan.

For each Sales table:

- A cashier of Business A cannot SELECT rows from Business B (RLS isolation).
- An accountant of Business A cannot SELECT `leads` rows (no `sales` access at all).
- A cashier of Business A can INSERT into `pos_sales` of Business A but cannot UPDATE someone else's sale in Business A (`updated_by != self` constraint enforced at app layer, not RLS).
- A cashier cannot INSERT directly into `pos_refunds` (RLS Pattern C); only the service-role-backed refund service can.
- A staff user cannot SELECT any Sales table.

### 10.3 API integration tests

Located under `tests/sales/api/`. Use Next.js' test harness running `vitest` against route handlers with a real (but local) Supabase instance.

Coverage:

- `POST /api/sales/pos/sales` — happy path cash, happy path DuitNow QR static, happy path DuitNow QR dynamic. Server cart math matches client. 403 for non-POS role. 400 for invalid input. Idempotency on sale number race.
- `POST /api/sales/pos/sales/[id]/void` — happy path. 409 when sale already voided. 409 when sale in closed close-out. 403 when threshold exceeded without PIN.
- `POST /api/sales/pos/refunds` — happy path full refund. Partial refund. 409 when refunding more than original qty. 403 above threshold without PIN. `restocks=true` flag preserved in payload.
- `POST /api/sales/closeouts/[id]/close` — happy path. Variance correctly computed. All non-voided sales of the day get stamped with `close_out_id`. Subsequent void on a closed-out sale returns 409.
- `POST /api/sales/leads/[id]/convert` — happy path. Lead status flips to WON. `converted_customer_id` and `converted_sale_id` are set. `leads.id` is preserved (not deleted).
- `GET /api/sales/pos/customer-search` — routes through `lib/marketing/upsertFromPos.ts`. Cashier returns 200, accountant returns 403.

### 10.4 Event-bus integration tests

Located under `tests/sales/events/`. Hard-blocked on D8 (Phase 0 dispatcher).

- After `POST /api/sales/pos/sales`, an `events_outbox` row with `name='sale.completed'` exists with the expected payload shape (Zod-validated against `SaleCompletedPayload`). Before D8 lands, this is the only assertion.
- After D8 lands: Finance's `transactions` row appears with the right amount and `linked_pos_sale_id`. Operations' stock decrements when add-on active. Marketing's customer metrics update.
- Replay test: re-running the same `sale.completed` event through the dispatcher does NOT produce duplicate `transactions` rows (idempotent on `sale_id`).
- Order independence: `sale.voided` arriving before `sale.completed` is processed (race) → both dedupe correctly. Final state: no `transactions` row exists, original sale is `voided`.
- `closeout.recorded` → Admin Notification Feed row exists.

### 10.5 Component tests

Located under `tests/sales/components/`. Use `@testing-library/react` + `vitest`. Component-level renders against MSW-mocked API responses.

| Component | Coverage |
|-----------|----------|
| `<Cart>` | Adding line, removing line, qty step, total updates live. Discount modal applies. SST chip renders when business has SST. |
| `<PaymentSheet>` | Tab switch between Cash / Static QR / Dynamic QR. Cash mode shows tender keypad. Dynamic QR mode triggers the QR fetch. |
| `<DuitNowQrModal>` | QR PNG renders. Reference label visible. Mark Received button gated by 2 s minimum display. |
| `<ManagerPinPrompt>` | 5 wrong PINs locks input for 5 min. |
| `<LeadBoard>` | Drag from NEW to CONTACTED triggers PATCH. WON column hidden by default. Toggle reveals WON. |
| `<ConvertToSaleModal>` | Prefills cart from `leads.interest` (parsed for line items). |
| `<RefundForm>` | Refund qty bounded by remaining-refundable per line. `restocks` toggle persists. |
| `<CloseoutSummary>` | Expected vs actual diff rendered with `status-warning` when variance > RM 1. |

### 10.6 CI gate

`.github/workflows/ci.yml` (added in M1; expanded over milestones):

- **M1:** `npm run type-check`, `npm run lint`, `npm run test` (unit only). Soft gate — warns but doesn't fail.
- **M2:** + RLS tests, + API integration tests. Hard gate.
- **M3:** + Lead pipeline component tests. Hard gate.
- **M4:** + Refund + closeout integration tests. + EMV QR string snapshot fixtures. Hard gate.
- **M5:** + Event-bus integration tests (when D8 lands). Coverage threshold: 80% on `lib/sales/**`.

---

## 11. Implementation Milestones

Five milestones plus a sequencing chart. Each ships behind a feature flag (`sales_*`) toggled per-business in `businesses.feature_flags jsonb` (added by Phase 0 Admin pillar — verify availability before M1).

### M1 — Schema + RLS + Mobile POS happy path

**Scope:**

- Migration `00000000000005_sales_init.sql` ships:
  - All 8 tables (`pos_sales`, `pos_sale_items`, `pos_refunds`, `pos_refund_items`, `leads`, `lead_notes`, `daily_close_outs`, `pos_sale_counters`).
  - Six new columns on `businesses` (DuitNow merchant fields, `discount_pin_required`, `manager_pin_hash`).
  - `customer_external_refs` registry inserts (depends on D4).
  - All RLS policies.
  - `create_pos_sale`, `acquire_sale_number` SQL functions.
- `lib/sales/cart.ts`, `lib/sales/rounding.ts`, `lib/sales/saleNumber.ts`, `lib/sales/schemas/posSale.ts`.
- New event names in `lib/events/types.ts`: `sale.completed`, `sale.refunded`, `sale.voided`, `closeout.recorded` (typed payloads).
- API: `POST /api/sales/pos/sales` (cash + static DuitNow QR only). `GET /api/sales/pos/products` (reads `products` table, gracefully empty if Operations not ready).
- UI: `/sales/pos` — `ProductGrid`, `Cart`, `PaymentSheet` (Cash tab + Static QR tab only — Dynamic QR is M4), `ReceiptView`.
- Tests: Unit (cart, rounding, saleNumber) + RLS + API integration on the sale-create path.

**Blockers:** D4 (`customer_external_refs` registry from Marketing's M1).

**Definition of Done:**

- A cashier on a phone, in a freshly-seeded business, can ring up a 2-item cash sale in `/sales/pos` and see the receipt screen.
- An `events_outbox` row with `name='sale.completed'` is present after the sale.
- The migration applies cleanly on a fresh Supabase reset (`npm run supabase:reset`).
- `npm run type-check`, `npm run lint`, and `npm run test` pass with no skipped Sales tests.

### M2 — Cross-pillar wiring (Operations stock, Finance invoice, Marketing customer lookup)

**Scope:**

- Marketing customer endpoints under Sales tree (per Q11): `GET /api/sales/pos/customer-search`, `POST /api/sales/pos/customer-upsert`. Both delegate to `lib/marketing/upsertFromPos.ts`.
- POS UI gains `CustomerAttachSheet` (search-as-you-type + new customer form).
- The `sale.completed` payload now carries `customer_id` when attached. Marketing's listener picks this up and updates customer metrics.
- Finance handler `lib/finance/handlers/onSaleCompleted.ts` lands (in Finance's plan; Sales' M2 PR _verifies_ via integration test that the `transactions` row appears).
- Operations handler `lib/operations/handlers/onSaleCompleted.ts` lands behind the Micro Stock Tracker add-on feature flag (verifies if flag on, no-op if off).

**Blockers:** D1 (Finance listener), D3 (Marketing `upsertFromPos.ts`).

**Definition of Done:**

- Cashier attaches a customer mid-sale → customer's `total_spend_myr` increases by the sale total after dispatcher runs.
- New customer entered at POS appears in `/marketing/customers` list (smoke test).
- Cross-pillar integration test passes against a real dispatcher (or asserts on `events_outbox` when dispatcher is pre-D8).

### M3 — Lead pipeline desktop Kanban + lead → won → POS conversion

**Scope:**

- Migration extension `00000000000006_sales_lead_indexes.sql` if any indexes need adjusting after M1 lands and real lead volume is simulated.
- API: full `/api/sales/leads/*` route inventory.
- UI: `/sales/leads` (Kanban, mobile + desktop responsive), `/sales/leads/[id]` (detail drawer/page), `/sales/pipeline` (desktop wide-Kanban alias), `ConvertToSaleModal`.
- The convert flow: from a NEGOTIATING (or QUALIFIED, owner-configurable) lead, "Convert to Sale" opens the POS preloaded with the customer + line items parsed from `leads.interest`. On payment, sale completes AND lead flips to WON in the same transaction.
- Listener for `lead.captured` from Marketing's landing-page surface (M3 ships a passive listener that inserts a `leads` row).

**Blockers:** D6 (Operations products table — needed to convert a lead's interest into real line items).

**Definition of Done:**

- A lead created in `/sales/leads`, dragged through CONTACTED → NEGOTIATING → "Convert to Sale" → cash sale → returns to leads list. WON column hidden by default; toggle reveals it.
- `leads.converted_customer_id` and `leads.converted_sale_id` are populated.
- `events_outbox` has both `lead.converted` and `sale.completed` rows from the conversion.

### M4 — Refunds, voids, daily close-out, dynamic DuitNow QR, manager PIN

**Scope:**

- API: `POST /api/sales/pos/sales/[id]/void`, `POST /api/sales/pos/refunds`, `POST /api/sales/pos/sales/[id]/duitnow-qr`, `/api/sales/closeouts/*`.
- UI: `RefundForm`, `VoidConfirm`, `ManagerPinPrompt`, `DuitNowQrModal`, `/sales/refunds` list, `/sales/closeout`.
- `qrcode` + `@types/qrcode` added to `package.json`.
- DuitNow EMV string assembly (`lib/sales/duitnow.ts`, `lib/sales/crc16.ts`).
- Manager PIN bcrypt hashing in `businesses.manager_pin_hash`. Settings UI under `/admin/settings/sales` (Admin contributes the page chrome; Sales contributes the form section).
- Cross-pillar reversal listeners in Finance (D9), Operations (`restocks=true` honour), Marketing.

**Blockers:** D9 (Finance refund reversal listener).

**Definition of Done:**

- Same-day void: cashier voids sale, sees red "VOIDED" stamp on receipt, Finance `transactions` row reversed (verified via Finance integration test).
- Partial refund: cashier refunds 1 of 2 line items, `restocks=true` on a snack, `restocks=false` on a service. Operations integration test confirms stock incremented only for the snack.
- Dynamic DuitNow QR: cashier enters RM 12.34 sale, taps Dynamic QR, sees QR with EMV TLV containing `5406` (length 6) `12.34`. CRC validates against PayNet test vectors.
- Close-out: at end of day, owner enters actual cash drawer count, sees variance, closes the day. All sales in the day are stamped `close_out_id`. Subsequent void on any of them returns 409.

### M5 — Mobile pipeline + final tests + verification + CI gate hardening

**Scope:**

- Mobile Lead board (single-column scroll with status filter chips).
- Mobile refund flow (a stripped-down `RefundForm` optimized for phones).
- Receipt printable view (CSS print stylesheet).
- WA-share text generator for receipt (mirrors Finance's late-payment reminder pattern).
- Full event-bus integration test suite (when D8 dispatcher is live).
- CI gate at 80% coverage on `lib/sales/**`.
- Update `lib/pillars/index.ts` with the final 6-surface Sales menu.

**Blockers:** D8 (Phase 0 dispatcher) — soft block; M5 ships the tests, but they `it.skip()` until D8 lands and are unskipped via a follow-up PR.

**Definition of Done:**

- Every section of §10 is implemented and passing.
- Sales pillar is feature-complete against `docs/v1-core-scope.md` §Pillar 5.
- Operations doc walkthrough (a 5-minute manual smoke test) passes for: ring-up cash sale, ring-up DuitNow dynamic sale, void same-day, refund next-day, close out the day, capture a lead, convert to sale.

### Milestone sequencing chart

```
M1 [Schema + RLS + cash POS]
   │
   ▼
   Wait on D4 (Marketing customer_external_refs)
   │
   ▼
M2 [Customer attach, Finance + Ops listeners]
   │   Wait on D1 (Finance listener), D3 (upsertFromPos)
   │
   ▼
M3 [Lead pipeline, convert flow]   ← Wait on D6 (Operations products)
   │
   ▼
M4 [Refunds, voids, closeout, dynamic QR]   ← Wait on D9 (Finance refund listener)
   │
   ▼
M5 [Mobile pipeline, full tests, CI gate]   ← Soft-wait on D8 (dispatcher)
```

Parallel work possible: M3 and M4 can be split between two devs once M2 ships, because they touch disjoint surfaces (leads vs refunds/closeout).

---

## 12. Open Questions for the User

1. **Lead status `QUALIFIED`** — `marketing-decisions.md` Q7 mentions `status IN ('NEW','QUALIFIED')` as the default Kanban filter, but `pillars/05-sales.md` §2.1 lists statuses as `New → Contacted → Negotiating → Won → Lost` (no `QUALIFIED`). Plan adopts the 6-status set (NEW, QUALIFIED, CONTACTED, NEGOTIATING, WON, LOST). Confirm `QUALIFIED` belongs between NEW and CONTACTED, or remove it.
2. **Manager PIN scope** — One PIN per business (the owner's), or per-manager? v1 plan defaults to one PIN, stored bcrypt in `businesses.manager_pin_hash`. Per-manager PIN is a v2 add-on. Confirm.
3. **Discount auto-approve thresholds** — Plan fixes RM 5 / 5% (from `pillars/05-sales.md` §2.2). Should owners be able to configure these per business in v1 Settings, or is the hard-coded threshold acceptable?
4. **Sale number prefix** — Plan uses `POS-{YYYY}-{NNNNNN}` to distinguish from Finance's `INV-{YYYY}-{NNNN}`. Confirm. (Alternative: share `INV-` and let the kind be implied by the row's table. Sharing is cleaner for bank-statement reconciliation but harder for cashier mental model.)
5. **Receipt printable view scope** — Print-to-paper via a CSS print stylesheet is in M5. Thermal printer pairing is explicitly out (Hardware add-on). The intermediate case — "share receipt PDF via WhatsApp" — needs a server-side PDF generator. Is that in v1 core, or punted to the Custom Document Builder add-on?
6. **Refund payment method** — Plan offers `cash` and `duitnow_transfer` as refund payment methods. For `duitnow_transfer`, the owner has to do the transfer themselves; should we make `bank_reference` a required field (currently optional) to force the owner to log the transfer ID for audit?
7. **Daily close-out semantics** — Plan ships single open close-out per business per day (one cashier closes for everyone). Per-cashier shift close-outs (cashier A closes their shift, cashier B opens theirs) is a v2 add-on. Confirm the single-close-out model is acceptable for v1.
8. **DuitNow EMV GUID + MCC defaults** — Plan uses placeholder GUID string `MY.PAYNET.MERCHANT` and MCC `0000`. Production code must pin against the official PayNet DuitNow QR Implementation Guide. Can you (or the founder) supply the canonical GUID and the MCC list we should ship with (or confirm `0000` is acceptable for a generic micro-SME pre-launch)?

---

## Appendix A — File paths the next pass will touch

Migrations:

- `supabase/migrations/00000000000005_sales_init.sql` (NEW, M1)
- `supabase/migrations/00000000000006_sales_lead_indexes.sql` (NEW, M3, optional)

UI pages under `app/(app)/sales/`:

- `page.tsx` (EDIT, M2), `pos/page.tsx` (EDIT, M1 — replace stub)
- `leads/page.tsx` (EDIT, M3), `leads/[id]/page.tsx` (NEW, M3)
- `pipeline/page.tsx` (NEW, M3)
- `sales/page.tsx`, `sales/[id]/page.tsx` (NEW, M2/M4)
- `refunds/page.tsx`, `closeout/page.tsx` (NEW, M4)

Route handlers under `app/api/sales/`:

- `pos/products/route.ts` · `pos/quote/route.ts` · `pos/sales/route.ts` (M1)
- `pos/customer-search/route.ts` · `pos/customer-upsert/route.ts` (M2)
- `pos/sales/[id]/route.ts` (M2)
- `pos/sales/[id]/void/route.ts` · `pos/sales/[id]/duitnow-qr/route.ts` · `pos/refunds/route.ts` (M4)
- `sales/route.ts` · `sales/[id]/route.ts` (M2)
- `refunds/route.ts` · `closeouts/route.ts` · `closeouts/today/route.ts` · `closeouts/[id]/close/route.ts` (M4)
- `leads/route.ts` · `leads/[id]/route.ts` · `leads/[id]/notes/route.ts` · `leads/[id]/convert/route.ts` (M3)

Logic under `lib/sales/`:

- M1: `cart.ts`, `rounding.ts`, `saleNumber.ts`, `schemas/posSale.ts`, `schemas/customer.ts`
- M3: `qualifyTransitions.ts`, `handlers/onLeadCaptured.ts`, `schemas/lead.ts`
- M4: `duitnow.ts`, `crc16.ts`, `refundRules.ts`, `closeout.ts`, `schemas/refund.ts`, `schemas/closeout.ts`

Components under `components/sales/`:

- `pos/{ProductGrid,ProductTile,VariantSheet,Cart,CartLine,DiscountModal,CashTender,PaymentSheet,ReceiptView}.tsx` (M1)
- `pos/CustomerAttachSheet.tsx` (M2)
- `pos/{DuitNowQrModal,ManagerPinPrompt}.tsx` (M4)
- `refunds/{RefundForm,RefundList}.tsx`, `voids/VoidConfirm.tsx`, `closeout/{CloseoutSummary,VarianceWarning}.tsx` (M4)
- `sales/{SaleList,SaleDetail}.tsx` (M2)
- `leads/{LeadBoard,LeadColumn,LeadCard,LeadDetailDrawer,LeadStatusFlow,LeadNotesTimeline,ConvertToSaleModal}.tsx` (M3)

Edits to existing files:

- `lib/events/types.ts` (EDIT, M1 — add 4 events)
- `lib/pillars/index.ts` (EDIT, M5 — add 4 surfaces)
- `lib/permissions.ts` (EDIT, M3 — comment/doc only, no scope change)

Tests under `tests/sales/`:

- `unit/{cart,rounding,saleNumber}.test.ts` (M1) · `unit/{duitnow,crc16,refundRules}.test.ts` (M4) · `unit/qualifyTransitions.test.ts` (M3)
- `rls/*.test.ts` (one per table, M1)
- `api/{sales,leads,refunds,closeouts}.test.ts` (staggered M1–M4)
- `components/*.test.tsx` (M3+) · `events/*.test.ts` (M5)

---

## Appendix B — Events Sales touches

| Event | Direction | Status in `lib/events/types.ts` | Payload type |
|-------|-----------|----------------------------------|--------------|
| `sale.completed` | Emit | **NEW (M1)** | `SaleCompletedPayload` |
| `sale.refunded` | Emit | **NEW (M4)** | `SaleRefundedPayload` |
| `sale.voided` | Emit | **NEW (M4)** | `SaleVoidedPayload` |
| `closeout.recorded` | Emit | **NEW (M4)** | `CloseoutRecordedPayload` |
| `customer.created` | Emit | Existing | `CustomerCreatedPayload` (source: `'pos'` or `'lead_conversion'`) |
| `lead.converted` | Emit | Existing | (payload TBD by Marketing — Sales contributes `{ lead_id, customer_id, sale_id, converted_at }`) |
| `lead.captured` | Consume | Existing | Marketing-defined payload; Sales handler inserts a `leads` row |

The four new event names that must land in `lib/events/types.ts` in M1:

```ts
export type EventName =
  | "invoice.sent"
  | "invoice.paid"
  | "transaction.recorded"
  | "order.delivered"
  | "booking.confirmed"
  | "booking.completed"
  | "stock.low"
  | "lead.captured"
  | "lead.converted"
  | "customer.created"
  | "leave.approved"
  | "leave.rejected"
  | "payroll.approved"
  | "task.due_soon"
  | "compliance.due_soon"
  // Sales additions (v1):
  | "sale.completed"
  | "sale.refunded"
  | "sale.voided"
  | "closeout.recorded";
```

---

## Appendix C — Schema cheat sheet

```
businesses (Phase 0 + Sales additions)
 ├── id, idcompany, name, state_code, tier
 ├── duitnow_id                  ← phase 0
 ├── duitnow_id_type             ← Sales M1
 ├── duitnow_merchant_name       ← Sales M1
 ├── duitnow_merchant_city       ← Sales M1
 ├── duitnow_mcc                 ← Sales M1
 ├── discount_pin_required       ← Sales M1
 ├── manager_pin_hash            ← Sales M4
 ├── sst_enabled, sst_rate_pct   ← phase 0
 └── invoice_number_*            ← phase 0

leads (Sales M1)
 ├── id, business_id
 ├── name, phone_e164, channel, interest, value_estimate_myr
 ├── status, lost_reason
 ├── assigned_user_id, last_contacted_at
 ├── converted_customer_id  → customers.id   (registered in customer_external_refs)
 ├── converted_sale_id      → pos_sales.id
 └── converted_at

lead_notes (Sales M3 — schema in M1 migration)
 ├── id, lead_id, business_id, author_user_id, body, created_at

pos_sales (Sales M1)
 ├── id, business_id, sale_number, cashier_user_id
 ├── customer_id    → customers.id  (registered in customer_external_refs)
 ├── lead_id        → leads.id
 ├── subtotal_myr, discount_*, sst_amount_myr, rounding_adjustment_myr, total_myr
 ├── payment_method ('cash' | 'duitnow_qr_static' | 'duitnow_qr_dynamic')
 ├── duitnow_reference, duitnow_qr_payload
 ├── payment_received_myr, change_myr
 ├── status ('completed' | 'voided')
 ├── voided_at, voided_by_user_id, void_reason
 ├── close_out_id → daily_close_outs.id
 ├── manager_approval_user_id
 └── created_at, updated_at

pos_sale_items (Sales M1)
 ├── id, sale_id, business_id
 ├── product_id, product_variant_id  → Operations tables
 ├── name_snapshot, sku_snapshot (denormalized for receipt durability)
 ├── qty, unit_price_myr
 ├── line_subtotal_myr, line_discount_myr
 ├── sst_applies, sst_amount_myr, line_total_myr
 └── position

pos_refunds (Sales M4)
 ├── id, business_id, refund_number, original_sale_id → pos_sales.id
 ├── cashier_user_id, manager_approval_user_id
 ├── refund_type ('full' | 'partial')
 ├── refund_subtotal_myr, sst_refund_myr, total_refund_myr
 ├── refund_payment_method ('cash' | 'duitnow_transfer')
 ├── bank_reference, reason
 └── created_at

pos_refund_items (Sales M4)
 ├── id, refund_id, business_id
 ├── original_sale_item_id → pos_sale_items.id
 ├── qty_refunded, refund_unit_price_myr
 ├── refund_line_subtotal_myr, refund_sst_myr, refund_line_total_myr
 ├── restocks (bool — drives Operations stock-increment listener)
 └── created_at

daily_close_outs (Sales M4)
 ├── id, business_id, cashier_user_id, close_out_date (unique per business)
 ├── opened_at, closed_at
 ├── expected_cash_myr, actual_cash_myr, cash_variance_myr
 ├── expected_duitnow_myr, actual_duitnow_myr, duitnow_variance_myr
 ├── expected_total_myr, actual_total_myr, total_variance_myr
 ├── sales_count, voids_count, refunds_count
 ├── notes, status ('open' | 'closed')
 └── created_at, updated_at

pos_sale_counters (Sales M1 — internal helper)
 ├── business_id, kind ('sale' | 'refund'), year
 └── last_n

customer_external_refs (Marketing M1) — Sales M1 inserts:
 ├── (leads, converted_customer_id, sales)
 └── (pos_sales, customer_id, sales)
```

End of Sales Implementation Plan v1.
