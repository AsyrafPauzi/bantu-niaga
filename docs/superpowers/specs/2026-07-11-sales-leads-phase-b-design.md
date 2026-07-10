# Sales Core — Phase B Leads Design

> **Status:** Approved in chat 2026-07-11 — awaiting owner review of this written spec  
> **Depends on:** Phase A POS (shipped)  
> **Pillar:** [05-sales.md](../../pillars/05-sales.md) · Checklist §7.1

---

## 1. Goals

Ship a **usable lead chase list** for Malaysian micro-SMEs with multiple sales people: capture prospects, update status, leave notes, set follow-up dates, assign staff, and convert won leads into Marketing customers — without kanban, push notifications, or Sales AI.

**Non-goals (Phase B):** Kanban board, push/email/WhatsApp reminders, stale-lead auto-chase, Sufi AI, lead → POS one-tap auto-sale, required assignment, refund/void, dynamic DuitNow.

---

## 2. Locked decisions

| Topic | Choice |
|-------|--------|
| Data model | Own `sales_leads` + `sales_lead_notes` (not Marketing customers-as-leads) |
| Statuses | `new` → `contacted` → `interested` → `won` / `lost` |
| Won vs convert | Separate: mark Won does **not** auto-convert; Convert is its own action |
| After Won UX | Soft prompt: “Convert to customer?” → Convert / Not now |
| Follow-up | Date (and optional time) on lead + list filters Due today / Overdue — **no** push/email |
| Create required | **Name + phone** |
| Optional on create | Channel, interest, estimated value (MYR), follow-up, assigned to |
| Convert phone match | **Link** existing Marketing customer by phone (no duplicate row) |
| UI | List + filters + detail (no kanban in core) |
| Assignment | Optional `assigned_to` + filter **Mine** |
| Access | Owner/manager full; `sales_rep` leads rw; cashier **no** leads (existing permissions) |

---

## 3. Concepts

### 3.1 Lead vs customer

- **Lead** = prospect in Sales (not yet, or not yet linked as, a Marketing customer).
- **Customer** = Marketing CRM row (`customers`).
- Convert writes or links a customer and stores `customer_id` on the lead. Lead row stays for history.

### 3.2 Won ≠ convert

1. Staff marks status **won** (deal closed in their mind).
2. Soft prompt offers Convert.
3. Convert upserts/links Marketing customer by normalised MY phone.
4. If phone already exists → link that customer (`customer_id`); do not create a second row.
5. If no match → create customer from lead name + phone (+ channel/notes as available).

### 3.3 Follow-up (core)

- `follow_up_at` timestamptz (nullable).
- List chips: **Due today**, **Overdue** (Malaysia calendar day, Asia/Kuala_Lumpur).
- Clearing follow-up is allowed.
- No notification jobs in Phase B.

### 3.4 Assignment

- `assigned_to` → `auth.users` / business member (nullable).
- Owner/manager/sales_rep (anyone with leads access) may set `assigned_to` to any **active business member** who has sales access (owner, manager, or sales_rep).
- Filter **Mine** = `assigned_to = current user`.

---

## 4. Data model

### 4.1 `sales_leads`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `business_id` | uuid FK | RLS tenant |
| `name` | text not null | |
| `phone_e164` | text not null | Normalised MY phone |
| `channel` | text null | `whatsapp` \| `instagram` \| `referral` \| `walk_in` \| `call` \| `other` |
| `interest` | text null | Free text (product/service interest) |
| `estimated_value_myr` | numeric(12,2) null | ≥ 0 |
| `status` | text not null | `new` \| `contacted` \| `interested` \| `won` \| `lost` |
| `follow_up_at` | timestamptz null | |
| `assigned_to` | uuid null | FK auth.users |
| `customer_id` | uuid null | FK customers — set on convert |
| `converted_at` | timestamptz null | |
| `lost_reason` | text null | Optional when status = lost |
| `created_by` | uuid not null | |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `(business_id, status, updated_at desc)`, `(business_id, follow_up_at)`, `(business_id, assigned_to)`, `(business_id, phone_e164)`.

Unique: **no** hard unique on phone (same person can re-enter as new lead later); convert dedupes via Marketing phone match.

### 4.2 `sales_lead_notes`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `lead_id` | uuid FK | cascade delete |
| `body` | text not null | Trimmed, max ~2000 chars |
| `created_by` | uuid not null | |
| `created_at` | timestamptz | |

Append-only in core (no edit/delete UI). RLS: same tenant + leads access roles.

### 4.3 RLS

Mirror POS pattern: select/insert/update for owner, manager, sales_rep (and any role with `sales.leads` rw). Cashiers excluded.

---

## 5. APIs

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/sales/leads` | List + query: `q`, `status`, `follow_up=due_today\|overdue`, `mine=1`, `assigned_to` |
| `POST` | `/api/sales/leads` | Create (name + phone required) |
| `GET` | `/api/sales/leads/[id]` | Detail + notes |
| `PATCH` | `/api/sales/leads/[id]` | Update fields / status / follow-up / assignee |
| `POST` | `/api/sales/leads/[id]/notes` | Append note |
| `POST` | `/api/sales/leads/[id]/convert` | Convert → Marketing customer; idempotent if already converted |

Validation via zod in `lib/sales/schemas.ts` (extend). Phone via existing `normalizeMyPhone`. Convert reuses Marketing upsert/dedup helpers where safe (same phone merge behaviour as POS upsert).

Errors: generic client messages; log server detail. Convert when already linked returns existing `customer_id` (200 idempotent).

---

## 6. UI

### 6.1 `/sales/leads`

- Header + **New lead**
- Filters: search, status, Due today, Overdue, Mine, assignee (if useful)
- Rows: name, phone, status pill, follow-up (overdue highlight), assignee initials, estimated value
- Empty state → create first lead

### 6.2 `/sales/leads/[id]` (or sheet/drawer on mobile)

- Editable fields
- Status control (select or buttons)
- Follow-up date picker
- Assignee select (business members with sales access)
- Notes timeline + add note
- When status = won and `customer_id` null → Convert prompt/banner
- When converted → link to Marketing customer
- Optional: “Open POS” link after convert (navigation only — not auto-sale)

### 6.3 Guide

Extend Sales first-visit guide step 4 copy once leads are real (already points at `/sales/leads`).

### 6.4 Checklist

Mark §7.1 lead items ✅ when shipped.

---

## 7. Security notes

- Always scope by `business_id` from session — never trust body `business_id`.
- Authorise with `canSurface(role, 'sales', 'leads')` / full sales access.
- Validate assignee is a member of the same business before write.
- Sanitise note/interest text for storage; encode on render (React default).
- No mass-assignment: whitelist PATCH fields in zod `.strict()`.

---

## 8. Out of scope (add-ons / later)

- Kanban / drag status
- Push, email, WhatsApp follow-up jobs
- Stale lead alerts (`sales-stale-leads`)
- Sufi Sales AI
- Required assignment
- Lead merge UI
- Auto-create sale from won lead

---

## 9. Success criteria

1. Owner can create a lead with name + phone and see it on the list.
2. Sales_rep can filter **Mine**, add notes, set follow-up, move status to won.
3. Convert links or creates Marketing customer by phone; second convert is idempotent.
4. Cashier cannot open leads surfaces.
5. Due today / Overdue filters match Malaysia day boundaries.

---

## 10. Implementation order (suggested)

1. Migration + RLS  
2. Schemas + access helpers  
3. APIs (CRUD, notes, convert)  
4. List + detail UI  
5. Checklist + guide copy polish  
6. Smoke: create → note → won → convert → customer exists
