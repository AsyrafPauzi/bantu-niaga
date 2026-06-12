# HR Pillar — Implementation Plan

> **Status:** Draft v1 — 2026-06-12
> **Owner:** HR Pillar engineer (single dev for this pass)
> **Companion docs:** [`docs/pillars/06-hr.md`](../pillars/06-hr.md), [`docs/v1-core-scope.md`](../v1-core-scope.md), [`docs/pillars/03-operations.md`](../pillars/03-operations.md), [`docs/pillars/01-admin.md`](../pillars/01-admin.md), [`docs/architecture/cross-pillar-sync.md`](../architecture/cross-pillar-sync.md)
> **Cross-pillar coupling:** HR is **mostly upstream**. It owns the canonical `staff` row and the leave calendar. Sales (`pos_sales.sold_by`), Operations (`bookings.assigned_to`), and Marketing (`customer_activities.assigned_to`) all carry `staff_id` foreign keys against HR-owned rows. Operations consumes HR's `leave.approved` event to block booking slots. Finance is decoupled in v1 because **payroll is explicitly out of scope** (see §1.2).

---

## 1. Goals & Non-Goals

### 1.1 Goals

The HR pillar in v1 must deliver, end-to-end:

1. **Canonical staff registry** with encrypted IC and bank fields, replacing IC-photo-in-WhatsApp habits. Source of truth for every `staff_id` foreign key in the rest of the codebase.
2. **Leave management** for AL (Annual Leave), EL (Emergency Leave), and MC (Medical Certificate), with per-business **AL carry-forward rules** (default cap = 1.5× annual entitlement, configurable).
3. **State-aware Malaysian public-holiday calendar** that auto-populates for the business's primary state, integrates with leave accruals (PH doesn't consume AL), and emits markers Operations can consume to block bookings.
4. **Per-business onboarding checklist** — a template the owner builds once, then auto-instantiates on every new staff record with assignees, due dates, and completion stamping.
5. **Letter generator** for the three v1 letter types — Offer, Confirmation, Termination — producing branded PDFs into Supabase Storage with signed share URLs. Uses the Admin `digital signature` flow for recipient sign-back.
6. **Self-service leave application** for staff via the mobile shell — apply, view balance, view history. Admin / HR Officer approves on the desktop shell.
7. **RBAC enforcement** at all three layers (RLS + middleware + UI) for the HR Officer role (privileged) and the Staff role (`self_only` scope on `staff` and `leave_applications`).
8. **Event emission** so downstream pillars stay consistent: `staff.created`, `staff.updated`, `staff.deactivated`, `staff.role_changed`, `leave.applied`, `leave.approved`, `leave.rejected`, `leave.cancelled`, `letter.issued`, `onboarding.completed`, `holiday.added`.

### 1.2 Non-Goals

The following are **explicitly out of v1** per [`docs/v1-core-scope.md`](../v1-core-scope.md) §"What's NOT in v1 Core" → HR row:

- **Statutory Payroll (EPF / SOCSO / EIS / PCB)** — deferred to a future add-on. The `payroll.approved` event name already in `lib/events/types.ts` is a forward-looking placeholder and **will not be emitted in v1**.
- **Shift Rota Scheduler** — add-on; do not build the `shifts[]` schema or weekly grid UI.
- **Self-Service Mobile Leave Forms via secure external URL** — that is the paid add-on form. v1 mobile self-service is gated by the standard auth flow on `/hr/me/...`; it requires the staff member to have a `users` row.
- **Time Clock / clock-in clock-out**.
- **EA Form generator**.
- **Per-pillar `staff_documents` table** — IC copies and signed letters live in Admin Storage with the `sensitive` flag and a back-reference (`entity_type='staff'`, `entity_id=staff.id`). HR doesn't ship its own file table.
- **Custom letter templates beyond the three v1 types** — Owners get a small "fill-in-the-blank" editor surface, not a drag-and-drop template builder. That belongs to the Admin Custom Document Builder add-on.
- **In-app push notifications for leave decisions** — Notification Feed (Admin §2.3) handles in-app surfacing. Email + the automated decision email are part of the Self-Service Leave Forms add-on.

---

## 2. Data Model

### 2.1 Table inventory (HR-owned)

| Table | Purpose | Scope | Owner pillar |
|-------|---------|-------|--------------|
| `staff` | Canonical employee record | Business-scoped, optional `users.id` link | HR |
| `staff_employment_history` | Role / salary / type changes over time | `staff_id` | HR |
| `leave_types` | AL / EL / MC / unpaid + per-business toggles | Business-scoped | HR |
| `leave_balances` | Per (staff, leave_type, leave_year) balance | `staff_id` | HR |
| `leave_applications` | Leave requests + approval state machine | `staff_id` | HR |
| `public_holidays` | Master state-level holiday list (curated annually) | Global (no `business_id`) | HR |
| `business_holiday_overrides` | Per-business additions, replacements, suppressions | Business-scoped | HR |
| `onboarding_templates` | Per-business default checklist definition | Business-scoped | HR |
| `onboarding_template_tasks` | Tasks under a template | `template_id` | HR |
| `staff_onboarding_checklists` | Instance of a template applied to one staff | `staff_id` | HR |
| `staff_onboarding_tasks` | Per-staff task rows with completion state | `checklist_id` | HR |
| `letter_templates` | Per-business letter body templates for v1 types | Business-scoped | HR |
| `staff_letters` | Issued letter instances + storage refs | `staff_id` | HR |

All HR tables include `business_id uuid not null` and have RLS enabled. All write paths funnel through an `lib/audit/log.ts` helper (Admin-owned; reference even though not yet built) and an `lib/events/emit.ts` helper that performs the transactional outbox insert.

### 2.2 `staff`

```sql
create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  staff_no text not null,                                -- public-facing short ID, used in self-service URL (add-on)
  full_name text not null,
  preferred_name text,
  ic_number_ciphertext bytea not null,                   -- pgcrypto envelope; see §10.3
  ic_copy_file_id uuid,                                  -- FK to Admin storage.files (loose; not enforced cross-pillar)
  emergency_name text,
  emergency_relationship text,
  emergency_phone_e164 text,
  bank_name text,
  bank_account_ciphertext bytea,
  role_title text not null,                              -- free-text job title; NOT the RBAC role
  employment_type text not null check (
    employment_type in ('full_time', 'part_time', 'contract', 'intern')
  ),
  start_date date not null,
  end_date date,                                          -- nullable; populated on termination
  status text not null default 'active' check (
    status in ('active', 'probation', 'on_leave', 'terminated', 'resigned')
  ),
  base_salary_myr numeric(12, 2),                         -- nullable; salary is optional in v1 (no payroll)
  annual_leave_entitlement_days numeric(5, 1) not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references public.users (id) on delete set null,
  unique (business_id, staff_no)
);

create index staff_business_idx on public.staff (business_id, status);
create index staff_user_idx on public.staff (user_id) where user_id is not null;
create index staff_active_lookup_idx
  on public.staff (business_id, full_name)
  where status in ('active', 'probation', 'on_leave');

alter table public.staff enable row level security;

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();
```

**Notes:** `user_id` is nullable — some staff never log in but still exist as rows for leave tracking and letter issuance. `ic_number_ciphertext` / `bank_account_ciphertext` use `pgcrypto.pgp_sym_encrypt` with a per-business KEK held in Supabase Vault (see §10.3); decryption only inside SECURITY DEFINER functions called from server-only routes. Downstream pillars reference `id` (UUID), not `staff_no`. `annual_leave_entitlement_days` lives on `staff` because Employment Act 1955 §60E ties AL entitlement to length of service.

### 2.3 `staff_employment_history`

```sql
create table if not exists public.staff_employment_history (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  changed_at timestamptz not null default now(),
  change_type text not null check (
    change_type in ('hired', 'promotion', 'salary_adjustment', 'role_change',
                    'status_change', 'terminated', 'resigned', 'rehired')
  ),
  previous_role_title text,
  new_role_title text,
  previous_salary_myr numeric(12, 2),
  new_salary_myr numeric(12, 2),
  previous_status text,
  new_status text,
  notes text,
  effective_date date not null,
  recorded_by_user_id uuid references public.users (id) on delete set null
);

create index staff_history_staff_idx on public.staff_employment_history (staff_id, changed_at desc);
create index staff_history_business_idx on public.staff_employment_history (business_id, changed_at desc);

alter table public.staff_employment_history enable row level security;
```

Append-only. Every mutation to `staff.role_title`, `staff.base_salary_myr`, `staff.status`, or `staff.employment_type` writes a row here through the HR mutation helpers (see §4.3). Never updated, never deleted.

### 2.4 `leave_types`

```sql
create table if not exists public.leave_types (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null check (code in ('AL', 'EL', 'MC', 'UNPAID')),
  display_name text not null,
  paid boolean not null default true,
  requires_attachment boolean not null default false,    -- MC defaults true
  counts_against_balance boolean not null default true,  -- UNPAID = false
  default_annual_days numeric(5, 1),                     -- nullable for MC / UNPAID
  carry_forward_enabled boolean not null default false,  -- only AL = true
  carry_forward_cap_multiplier numeric(4, 2) default 1.5,
  carry_forward_expires_month smallint check (carry_forward_expires_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create index leave_types_business_idx on public.leave_types (business_id);

alter table public.leave_types enable row level security;
```

**Seed strategy:** On business creation (a Phase 0 hook), seed the four canonical types: `AL`, `EL`, `MC`, `UNPAID`. The owner can tweak names, `default_annual_days`, and carry-forward settings, but cannot add new codes in v1 — keeping the leave-type taxonomy stable across the codebase simplifies reporting.

### 2.5 `leave_balances`

```sql
create table if not exists public.leave_balances (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  leave_year smallint not null,                          -- e.g. 2026
  opening_balance_days numeric(5, 1) not null default 0, -- after carry-forward
  accrued_days numeric(5, 1) not null default 0,         -- annual entitlement granted
  taken_days numeric(5, 1) not null default 0,           -- decremented on leave.approved
  carry_forward_in_days numeric(5, 1) not null default 0,
  carry_forward_out_days numeric(5, 1) not null default 0,
  carry_forward_expires_on date,
  computed_at timestamptz not null default now(),
  unique (staff_id, leave_type_id, leave_year)
);

create index leave_balances_lookup_idx
  on public.leave_balances (staff_id, leave_year);

alter table public.leave_balances enable row level security;
```

**Derived view** for "what's available right now":

```sql
create or replace view public.leave_balances_current as
select
  lb.*,
  (lb.opening_balance_days + lb.accrued_days - lb.taken_days) as available_days,
  case
    when lb.carry_forward_expires_on is not null
      and lb.carry_forward_expires_on < current_date
      and lb.taken_days < lb.carry_forward_in_days
    then lb.carry_forward_in_days - lb.taken_days
    else 0
  end as forfeited_days
from public.leave_balances lb;
```

### 2.6 `leave_applications`

```sql
create table if not exists public.leave_applications (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  half_day_start boolean not null default false,
  half_day_end boolean not null default false,
  total_days numeric(5, 1) not null,                     -- computed in app; excludes PH + weekends
  reason text,
  attachment_file_id uuid,                                -- MC photo in Admin storage
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  submitted_by_user_id uuid references public.users (id) on delete set null,
  reviewed_by_user_id uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leave_applications_staff_idx
  on public.leave_applications (staff_id, starts_on desc);
create index leave_applications_pending_queue_idx
  on public.leave_applications (business_id, status, created_at desc)
  where status = 'pending';
create index leave_applications_active_range_idx
  on public.leave_applications (business_id, starts_on, ends_on)
  where status = 'approved';

alter table public.leave_applications enable row level security;

create trigger leave_applications_set_updated_at
  before update on public.leave_applications
  for each row execute function public.set_updated_at();
```

The `leave_applications_active_range_idx` index is what Operations queries to discover whether a staff resource is on leave when rendering the booking calendar (see §3.4).

### 2.7 `public_holidays`

```sql
create table if not exists public.public_holidays (
  id uuid primary key default uuid_generate_v4(),
  state_code text not null,                              -- 'FED' for federal-all-states
  holiday_date date not null,
  name text not null,
  notes text,
  is_replacement boolean not null default false,         -- e.g. Monday after weekend PH
  source text not null default 'curated',                -- 'curated' | 'override'
  created_at timestamptz not null default now(),
  unique (state_code, holiday_date, name)
);

create index public_holidays_lookup_idx
  on public.public_holidays (state_code, holiday_date);
create index public_holidays_year_idx
  on public.public_holidays (date_trunc('year', holiday_date));

alter table public.public_holidays enable row level security;
```

This table is **global** — there's no `business_id`. All authenticated users can `SELECT` from it. INSERTs are restricted to the Supabase service role (curator updates it from `docs/data/holidays-MY-2026.json` once a year via a seed migration). See §7.

### 2.8 `business_holiday_overrides`

```sql
create table if not exists public.business_holiday_overrides (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  override_type text not null check (
    override_type in ('add', 'suppress', 'replace')
  ),
  holiday_date date not null,
  replaces_holiday_id uuid references public.public_holidays (id) on delete set null,
  name text,
  notes text,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references public.users (id) on delete set null
);

create index business_holiday_overrides_business_idx
  on public.business_holiday_overrides (business_id, holiday_date);

alter table public.business_holiday_overrides enable row level security;
```

`override_type` semantics:

- `add` — extra business closure not on the state list (e.g. owner's umrah trip).
- `suppress` — business operates on a state public holiday (e.g. hari raya extension is the only day shop closes; opt-out of others).
- `replace` — Saturday holiday moved to following Monday for a 5-day-week business; `replaces_holiday_id` references the original.

### 2.9 `onboarding_templates` + `onboarding_template_tasks`

```sql
create table if not exists public.onboarding_templates (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,             -- only one default per business
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create unique index onboarding_templates_one_default_idx
  on public.onboarding_templates (business_id)
  where is_default;

alter table public.onboarding_templates enable row level security;

create table if not exists public.onboarding_template_tasks (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  template_id uuid not null references public.onboarding_templates (id) on delete cascade,
  position smallint not null,
  title text not null,
  description text,
  task_type text not null check (
    task_type in ('boolean', 'file_upload', 'signature', 'data_entry')
  ),
  assignee_role text not null check (
    assignee_role in ('hr_officer', 'manager', 'staff', 'owner')
  ),
  due_after_start_days smallint not null default 0,      -- 0 = on start date, 7 = 1 week after
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create index onboarding_template_tasks_template_idx
  on public.onboarding_template_tasks (template_id, position);

alter table public.onboarding_template_tasks enable row level security;
```

### 2.10 `staff_onboarding_checklists` + `staff_onboarding_tasks`

```sql
create table if not exists public.staff_onboarding_checklists (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  template_id uuid references public.onboarding_templates (id) on delete set null,
  status text not null default 'in_progress' check (
    status in ('in_progress', 'completed', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (staff_id)                                       -- one active checklist per staff
);

create index staff_onboarding_checklists_business_idx
  on public.staff_onboarding_checklists (business_id, status);

alter table public.staff_onboarding_checklists enable row level security;

create table if not exists public.staff_onboarding_tasks (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  checklist_id uuid not null references public.staff_onboarding_checklists (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  position smallint not null,
  title text not null,
  task_type text not null,
  assignee_user_id uuid references public.users (id) on delete set null,
  due_on date,
  status text not null default 'open' check (
    status in ('open', 'done', 'skipped')
  ),
  evidence_file_id uuid,                                  -- for file_upload / signature
  data_entry_value jsonb,                                 -- for data_entry (e.g. EPF number)
  completed_at timestamptz,
  completed_by_user_id uuid references public.users (id) on delete set null
);

create index staff_onboarding_tasks_checklist_idx
  on public.staff_onboarding_tasks (checklist_id, position);
create index staff_onboarding_tasks_assignee_idx
  on public.staff_onboarding_tasks (assignee_user_id, status)
  where status = 'open';

alter table public.staff_onboarding_tasks enable row level security;
```

The `assignee_user_id` on instantiation is resolved at template-apply time (see §8.3).

### 2.11 `letter_templates`

```sql
create table if not exists public.letter_templates (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  letter_type text not null check (
    letter_type in ('offer', 'confirmation', 'salary_adjustment', 'termination')
  ),
  name text not null,
  body_markdown text not null,                            -- mustache-style {{variables}}
  signatory_name text,
  signatory_title text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, letter_type, name)
);

create unique index letter_templates_one_default_per_type_idx
  on public.letter_templates (business_id, letter_type)
  where is_default;

alter table public.letter_templates enable row level security;
```

Templates ship with seeded defaults per `letter_type` on business creation. The body is Markdown so the editor can be a plain `<textarea>` (no rich-text dep). PDF rendering converts Markdown + variable substitution to a React PDF tree (see §9).

### 2.12 `staff_letters`

```sql
create table if not exists public.staff_letters (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  letter_template_id uuid references public.letter_templates (id) on delete set null,
  letter_type text not null,
  variables jsonb not null,                               -- snapshotted at render
  pdf_storage_path text not null,                         -- supabase storage bucket key
  share_hash text unique,                                  -- for digital signature link
  signed_at timestamptz,
  signed_pdf_storage_path text,
  signed_by_ip inet,
  issued_by_user_id uuid references public.users (id) on delete set null,
  issued_at timestamptz not null default now()
);

create index staff_letters_staff_idx on public.staff_letters (staff_id, issued_at desc);
create index staff_letters_business_idx on public.staff_letters (business_id, issued_at desc);
create index staff_letters_share_hash_idx on public.staff_letters (share_hash) where share_hash is not null;

alter table public.staff_letters enable row level security;
```

The `share_hash` reuses the same secure-hash convention as Finance invoices and Admin documents (random 8-char base32, unique per business). The signed PDF arrives via Admin's `digital_signature.applied` flow (Admin pillar), not via an HR-owned signature route.

---

## 3. Cross-Pillar Contracts (most important section)

### 3.1 Events HR emits

All HR events follow `pillar.subject.action`. Payload shapes live in `lib/events/hr-payloads.ts` (new file). All emissions go through `lib/events/emit.ts` which inserts into `events_outbox` inside the same transaction as the source mutation (Phase 0 outbox pattern).

```ts
// lib/events/hr-payloads.ts
type LeaveCode = "AL" | "EL" | "MC" | "UNPAID";

export interface StaffCreatedPayload {
  staff_id: string; staff_no: string; full_name: string;
  role_title: string; employment_type: "full_time" | "part_time" | "contract" | "intern";
  start_date: string; has_user_account: boolean;
}
export interface StaffUpdatedPayload {
  staff_id: string;
  changed_fields: Array<"full_name" | "role_title" | "employment_type" | "base_salary_myr">;
}
export interface StaffDeactivatedPayload {
  staff_id: string; reason: "terminated" | "resigned"; effective_date: string;
}
export interface StaffRoleChangedPayload {
  staff_id: string; previous_role_title: string; new_role_title: string; effective_date: string;
}
export interface LeaveAppliedPayload {
  leave_application_id: string; staff_id: string; leave_type_code: LeaveCode;
  starts_on: string; ends_on: string; total_days: number;
}
export interface LeaveApprovedPayload extends LeaveAppliedPayload { approved_by_user_id: string; }
export interface LeaveRejectedPayload {
  leave_application_id: string; staff_id: string; rejected_by_user_id: string; reason: string | null;
}
export interface LeaveCancelledPayload {
  leave_application_id: string; staff_id: string; cancelled_by_user_id: string;
}
export interface LetterIssuedPayload {
  staff_letter_id: string; staff_id: string;
  letter_type: "offer" | "confirmation" | "salary_adjustment" | "termination";
  share_hash: string;
}
export interface OnboardingCompletedPayload {
  checklist_id: string; staff_id: string; task_count: number; completed_at: string;
}
export interface HolidayAddedPayload {
  override_id: string; holiday_date: string;
  override_type: "add" | "suppress" | "replace"; name: string | null;
}
```

| Event | Emitter | Listeners | Effect |
|-------|---------|-----------|--------|
| `staff.created` | HR `POST /api/hr/staff` | Sales · Operations · Marketing · Admin | Refresh staff dropdowns (`pos_sales.sold_by`, `bookings.assigned_to`, `customer_activities.assigned_to`); Admin notification "New staff: <name>". |
| `staff.updated` | HR `PATCH /api/hr/staff/[id]` | Sales · Operations · Marketing | Invalidate cached staff display names in downstream UI. |
| `staff.deactivated` | HR (status → `terminated`/`resigned`) | Sales · Operations · Marketing · Admin | Each pillar locally decides whether to suppress in active dropdowns while keeping historical references intact (see §3.4). |
| `staff.role_changed` | HR (role_title change via mutation) | Admin | Admin notification + audit log entry. |
| `leave.applied` | HR `POST /api/hr/leave` | Admin | Notification Feed: "Leave request pending — <staff>, <dates>". |
| `leave.approved` | HR (status → `approved`) | Operations · Admin · (add-on: email) | Operations blocks booking slots for `staff_id` over the date range; Admin notification. |
| `leave.rejected` | HR (status → `rejected`) | Admin · (add-on: email) | Admin notification; email if Self-Service add-on. |
| `leave.cancelled` | HR (status → `cancelled`) | Operations · Admin | Operations un-blocks the previously-blocked booking slots. |
| `letter.issued` | HR `POST /api/hr/letters` | Admin | Notification: "Letter generated — <type>". The signature flow itself emits a separate Admin event (`document.signed`) when the recipient signs. |
| `onboarding.completed` | HR (checklist auto-stamped) | Admin | Notification: "Onboarding complete for <staff>". |
| `holiday.added` | HR `POST /api/hr/holiday-overrides` | Operations · Admin | Operations refreshes booking calendar markers. |

### 3.2 Events HR consumes (likely few — HR is mostly upstream)

| Event | Emitter | HR handler |
|-------|---------|------------|
| `task.due_soon` | Admin | If the task is an onboarding task (`source_entity_type='staff_onboarding_tasks'`), surface it in the HR Officer's `/hr` dashboard "Action needed" panel. |
| (none from Sales / Finance / Marketing in v1) | — | HR is structurally upstream. Once Statutory Payroll lands as an add-on, HR will consume `payroll.computed` events from that add-on. Not v1. |

### 3.3 Blocked-on (other dev's deliverables)

HR cannot fully land without these from other pillars / Phase 0 follow-ups. List them up-front so the M0/M1 sequencing is unambiguous:

| Dependency | Owner | Used by HR for |
|------------|-------|----------------|
| `lib/audit/log.ts` helper | Admin pillar | Every HR write — leave approval, role change, letter issuance, staff deactivation. HR's mutation helpers `await auditLog({...})` inside the same transaction as the entity write. |
| `lib/events/emit.ts` outbox helper | Phase 0 → Admin | Every HR cross-pillar event. Signature assumed: `emit(supabase, { name, payload, business_id, emitted_by_user_id })`. |
| Admin Storage `storage.files` row + sensitive flag | Admin pillar | IC copies, MC photos, signed letter PDFs. HR holds `*_file_id uuid` columns referencing this loosely (not as DB FK). |
| Admin `digital_signature` route | Admin pillar | Recipient-side signing on letter share URLs. HR generates the share hash and registers it with Admin's signature service. |
| Notification Feed surface (Admin §2.3) | Admin pillar | The receiver of all HR notifications. HR doesn't render the feed — it just emits events Admin renders. |
| `users` row with `role='staff'` for self-service login | Phase 0 / Team management | Staff-side mobile shell. v1 makes `staff.user_id` nullable so non-login staff still exist; only those with a `users` row get `/hr/me/...`. |
| `currentBusinessState()` accessor on `businesses.state_code` | Phase 0 (already present per init.sql line 25) | Picking the correct rows from `public_holidays` for the business. |

### 3.4 Downstream contract: `staff_id` referenced by Sales / Operations / Marketing

HR owns the canonical `staff` table. Other pillars carry `staff_id` FKs that **must** reference `public.staff(id)`:

- **Sales** — `pos_sales.sold_by uuid references public.staff(id)`. Refunds preserve original `sold_by`.
- **Operations** — `bookings.assigned_to uuid references public.staff(id)`. Calendar groups by staff resource when set.
- **Marketing** — `customer_activities.assigned_to uuid references public.staff(id)`.

**Cascade rules.** HR rows are **never hard-deleted** in v1. Termination flips `status` to `terminated` and emits `staff.deactivated`; historical references stay intact. On `staff.deactivated`, each downstream pillar decides locally: hide from new-assignment pickers, keep in historical reports. HR never forces a downstream cascade — downstream subscribes to `staff.deactivated` and updates its own caches.

**Leave → booking block contract.** On `leave.approved` with `{ staff_id, starts_on, ends_on }`, Operations runs an async handler that:

1. Looks up future bookings where `assigned_to = staff_id` AND `starts_at::date` ∈ `[starts_on, ends_on]`.
2. Flags conflicts with a `booking.conflict_with_leave` notification — does NOT auto-cancel (owner decides).
3. Inserts a row into `operations.staff_availability_blocks` (Operations-owned) covering the range, so the booking calendar greys out the staff resource and the public booking page hides those slots.

On `leave.cancelled`, Operations removes the matching block. Idempotency keyed on `leave_application_id` in `source_id`.

**Letter → audit contract.** Every `letter.issued` event writes an `audit_log` row with `action='hr.letter.issue'`, `entity_type='staff_letter'`, `entity_id=staff_letter_id`. The HR mutation helper writes the audit row inside the same transaction (NOT via the event consumer — audit must be atomic with the source change).

---

## 4. API Surface

### 4.1 Route inventory

All routes live under `app/api/hr/`. Every handler runs through `middleware.ts` for the RBAC fast-fail check (Phase 0 middleware) and uses `lib/supabase/server.ts` for the request-scoped client. Server Actions also exist for the desktop forms; the table below lists the canonical REST surface — Server Actions wrap the same Zod schemas.

| Method | Path | Purpose | RBAC guard | Side effects |
|--------|------|---------|------------|--------------|
| `GET` | `/api/hr/staff` | List staff (paged, filter by status / role_title) | `canSurface(role,'hr','employees') = true` | none |
| `POST` | `/api/hr/staff` | Create staff + auto-instantiate default onboarding checklist | `hasFullAccess('hr')` | `staff.created` event; audit `hr.staff.create`; checklist insert |
| `GET` | `/api/hr/staff/[id]` | Read one. Staff role: only if `id == own staff record` | `self_only` for staff | none |
| `PATCH` | `/api/hr/staff/[id]` | Update. Salary / role / status changes emit specific events | `hasFullAccess('hr')` | `staff.updated`, optionally `staff.role_changed`, `staff.deactivated`; `staff_employment_history` insert; audit `hr.staff.update` |
| `DELETE` | `/api/hr/staff/[id]` | Soft-delete (status → terminated). Hard delete never exposed. | `hasFullAccess('hr')` | `staff.deactivated`; audit `hr.staff.terminate` |
| `GET` | `/api/hr/staff/[id]/employment-history` | Read history rows | `hasFullAccess('hr')` or `self_only` | none |
| `GET` | `/api/hr/leave-types` | List leave types for the business | any HR access | none |
| `PATCH` | `/api/hr/leave-types/[id]` | Update naming / carry-forward settings | `hasFullAccess('hr')` | audit `hr.leave_type.update` |
| `GET` | `/api/hr/leave/balances` | Current balances (filtered to self for `staff` role) | `self_only` | none |
| `GET` | `/api/hr/leave/applications` | List leave applications (filter by status, staff_id) | `hasFullAccess('hr')` for all; `self_only` for staff | none |
| `POST` | `/api/hr/leave/applications` | Apply for leave (mobile self-service surface) | any HR access (self) | `leave.applied` event; audit `hr.leave.apply` |
| `PATCH` | `/api/hr/leave/applications/[id]/approve` | Approve → decrement balance | `hasFullAccess('hr')` | `leave.approved` event; balance decrement; audit `hr.leave.approve` |
| `PATCH` | `/api/hr/leave/applications/[id]/reject` | Reject | `hasFullAccess('hr')` | `leave.rejected` event; audit `hr.leave.reject` |
| `PATCH` | `/api/hr/leave/applications/[id]/cancel` | Cancel (only by submitter while pending, or HR Officer anytime before start) | submitter `self_only` or `hasFullAccess('hr')` | `leave.cancelled` event; balance restore; audit `hr.leave.cancel` |
| `GET` | `/api/hr/holidays` | Effective holiday list (state list + overrides) for a date range | any HR access | none |
| `POST` | `/api/hr/holiday-overrides` | Add a business override | `hasFullAccess('hr')` | `holiday.added` event; audit `hr.holiday.override` |
| `DELETE` | `/api/hr/holiday-overrides/[id]` | Remove override | `hasFullAccess('hr')` | audit `hr.holiday.override_remove` |
| `GET` | `/api/hr/onboarding/templates` | List templates | `hasFullAccess('hr')` | none |
| `POST` | `/api/hr/onboarding/templates` | Create template + tasks | `hasFullAccess('hr')` | audit `hr.onboarding.template_create` |
| `PATCH` | `/api/hr/onboarding/templates/[id]` | Update template + reorder/edit tasks (replace-all semantics) | `hasFullAccess('hr')` | audit `hr.onboarding.template_update` |
| `GET` | `/api/hr/onboarding/checklists/[staffId]` | Get a staff's checklist + tasks | `hasFullAccess('hr')` or `self_only` | none |
| `PATCH` | `/api/hr/onboarding/tasks/[id]/complete` | Mark task done (with optional evidence) | `hasFullAccess('hr')` or assigned-user-only | possibly `onboarding.completed` event if last task; audit `hr.onboarding.task_complete` |
| `GET` | `/api/hr/letters/templates` | List letter templates | `hasFullAccess('hr')` | none |
| `PATCH` | `/api/hr/letters/templates/[id]` | Edit body markdown / signatory | `hasFullAccess('hr')` | audit `hr.letter_template.update` |
| `POST` | `/api/hr/letters` | Issue a letter (render PDF + store + share hash) | `hasFullAccess('hr')` | `letter.issued` event; audit `hr.letter.issue` |
| `GET` | `/api/hr/letters/[id]` | Read letter metadata + signed-pdf path | `hasFullAccess('hr')` | none |
| `GET` | `/api/hr/letters/[id]/pdf` | Signed URL for the PDF | `hasFullAccess('hr')` or assigned recipient | none |
| `POST` | `/api/cron/hr/carry-forward` | Edge Function — annual carry-forward batch | service role only | balance roll; audit per staff |

### 4.2 Schemas (Zod)

Schemas live in `lib/hr/schemas.ts`. One per route; representative shapes below.

```ts
import { z } from "zod";

export const StaffCreateSchema = z.object({
  full_name: z.string().min(2).max(120),
  preferred_name: z.string().max(60).optional(),
  ic_number: z.string().regex(/^\d{6}-\d{2}-\d{4}$/, "NRIC format ######-##-####"),
  emergency_name: z.string().min(2).max(120).optional(),
  emergency_relationship: z.string().max(40).optional(),
  emergency_phone_e164: z.string().regex(/^\+60\d{8,11}$/).optional(),
  bank_name: z.string().max(80).optional(),
  bank_account: z.string().max(40).optional(),
  role_title: z.string().min(2).max(80),
  employment_type: z.enum(["full_time", "part_time", "contract", "intern"]),
  start_date: z.string().date(),
  base_salary_myr: z.number().nonnegative().optional(),
  annual_leave_entitlement_days: z.number().min(0).max(60).default(8),
  apply_default_onboarding: z.boolean().default(true),
});
export const StaffUpdateSchema = StaffCreateSchema.partial().extend({
  status: z.enum(["active", "probation", "on_leave", "terminated", "resigned"]).optional(),
  end_date: z.string().date().optional(),
});

export const LeaveApplySchema = z.object({
  staff_id: z.string().uuid(),
  leave_type_code: z.enum(["AL", "EL", "MC", "UNPAID"]),
  starts_on: z.string().date(),
  ends_on: z.string().date(),
  half_day_start: z.boolean().default(false),
  half_day_end: z.boolean().default(false),
  reason: z.string().max(500).optional(),
  attachment_file_id: z.string().uuid().optional(),
})
.refine(v => new Date(v.ends_on) >= new Date(v.starts_on),
  { message: "ends_on >= starts_on", path: ["ends_on"] })
.refine(v => v.leave_type_code !== "MC" || v.attachment_file_id != null,
  { message: "MC requires attachment", path: ["attachment_file_id"] });

export const LeaveDecisionSchema = z.object({ review_notes: z.string().max(500).optional() });

export const HolidayOverrideSchema = z.object({
  override_type: z.enum(["add", "suppress", "replace"]),
  holiday_date: z.string().date(),
  replaces_holiday_id: z.string().uuid().optional(),
  name: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

export const OnboardingTemplateSchema = z.object({
  name: z.string().min(2).max(80),
  is_default: z.boolean().default(false),
  tasks: z.array(z.object({
    position: z.number().int().nonnegative(),
    title: z.string().min(2).max(160),
    description: z.string().max(500).optional(),
    task_type: z.enum(["boolean", "file_upload", "signature", "data_entry"]),
    assignee_role: z.enum(["hr_officer", "manager", "staff", "owner"]),
    due_after_start_days: z.number().int().min(0).max(180).default(0),
    required: z.boolean().default(true),
  })).min(1),
});

export const LetterIssueSchema = z.object({
  staff_id: z.string().uuid(),
  letter_type: z.enum(["offer", "confirmation", "salary_adjustment", "termination"]),
  letter_template_id: z.string().uuid().optional(),
  variable_overrides: z.record(z.string(), z.string()).optional(),
});
```

### 4.3 Mutations that write to `events_outbox`

Every HR write that produces a cross-pillar event funnels through `lib/hr/mutations.ts`, which wraps **entity insert → audit log → outbox emit** in a single transaction. Representative shape:

```ts
// lib/hr/mutations.ts
export async function createStaff(supabase: SupabaseClient, args: {
  business_id: string; actor_user_id: string; input: StaffCreate;
}) {
  const staff = await insertStaffRow(supabase, args);                // §2.2 row
  await insertEmploymentHistoryRow(supabase, staff, "hired");        // §2.3 row
  await seedInitialLeaveBalances(supabase, staff);                   // §2.5 seed
  if (args.input.apply_default_onboarding) {
    await instantiateDefaultOnboardingChecklist(supabase, staff);    // §2.10
  }
  await auditLog(supabase, {
    business_id: args.business_id, actor_user_id: args.actor_user_id,
    action: "hr.staff.create", entity_type: "staff", entity_id: staff.id,
    diff: { after: staff },
  });
  await emit(supabase, {
    business_id: args.business_id, emitted_by_user_id: args.actor_user_id,
    name: "staff.created", payload: toStaffCreatedPayload(staff),
  });
  return staff;
}
```

Same pattern repeats for `approveLeave`, `rejectLeave`, `cancelLeave`, `issueLetter`, `terminateStaff`, `addHolidayOverride`, `completeOnboardingTask`.

Transaction wrapping uses `withTransaction()` from `lib/supabase/server.ts` (Phase 0). If absent, fall back to a Supabase RPC (`hr_create_staff` etc.) that runs the same work inside Postgres — preferred because the outbox insert is then guaranteed atomic with the entity write, which is the whole point of the outbox pattern.

---

## 5. UI Surfaces

### 5.1 Route inventory

HR has two faces: an admin face on the desktop shell (HR Officer / Owner / Manager), and a thin self-service face on the mobile shell (Staff). Routes are listed with their primary shell and the surface key passed to `<RequirePermission>`.

| Route | Shell (primary) | Audience | Surface key |
|-------|-----------------|----------|-------------|
| `/hr` | Desktop | HR Officer / Owner / Manager | `hr` |
| `/hr/staff` | Desktop | HR Officer / Owner / Manager | `hr.employees` |
| `/hr/staff/[id]` | Desktop | HR Officer; staff `self_only` redirected to `/hr/me` | `hr.employees` |
| `/hr/staff/[id]/letters` | Desktop | HR Officer | `hr.letters` |
| `/hr/staff/[id]/onboarding` | Desktop | HR Officer + assigned task user | `hr.onboarding` |
| `/hr/leave` | Desktop | HR Officer (approval queue + calendar) | `hr.leave` |
| `/hr/leave/calendar` | Desktop | HR Officer / Manager | `hr.leave` |
| `/hr/holidays` | Desktop | HR Officer (state list + overrides editor) | `hr.holidays` |
| `/hr/onboarding/templates` | Desktop | HR Officer | `hr.onboarding` |
| `/hr/letters/templates` | Desktop | HR Officer | `hr.letters` |
| `/hr/me` | Mobile | Staff (self) | `hr.leave` (self_only) |
| `/hr/me/leave/new` | Mobile | Staff (self) | `hr.leave` (self_only) |
| `/hr/me/leave/[id]` | Mobile | Staff (self) | `hr.leave` (self_only) |
| `/hr/me/onboarding` | Mobile | Staff (self) | `hr.onboarding` (self_only) |
| `/share/letter/[hash]` | Adaptive (public) | Letter recipient | (no auth — share hash check) |

All admin routes wrap their `default export` in `<DesktopShell>`. Self-service routes use `<MobileShell>`. The recipient signature route on `/share/letter/[hash]` uses `<AdaptiveShell>` because recipients can open the link on phone or desktop.

### 5.2 Component inventory

All new components live under `components/hr/`:

| Component | Used by |
|-----------|---------|
| `StaffDirectoryTable` | `/hr/staff` |
| `StaffProfileCard` | `/hr/staff/[id]` |
| `StaffFormDialog` | New + edit (desktop drawer) |
| `EmploymentHistoryTimeline` | `/hr/staff/[id]` |
| `LeaveApprovalQueue` | `/hr/leave` |
| `LeaveCalendar` | `/hr/leave/calendar` |
| `LeaveBalanceCard` | `/hr/me`, `/hr/staff/[id]` |
| `LeaveApplyForm` | `/hr/me/leave/new` (mobile-first) |
| `HolidayCalendarEditor` | `/hr/holidays` |
| `OnboardingTemplateBuilder` | `/hr/onboarding/templates` |
| `OnboardingTaskRow` | desktop + mobile checklist views |
| `LetterTemplateEditor` | `/hr/letters/templates` |
| `LetterIssueDialog` | `/hr/staff/[id]/letters` |
| `LetterRecipientSigner` | `/share/letter/[hash]` |
| `IcInput` | Staff form (formats + validates IC) |
| `EncryptedFieldDisplay` | Profile views (masks ciphertext; server-decrypts on action) |

Styling uses existing tokens: surfaces `bg-cream-100`, body `text-ink`, primary actions `bg-brand-500 text-white`, approve `bg-status-success`, reject `bg-status-danger`, expiring-carry-forward warnings `bg-status-warning`, active calendar-day strokes `border-accent-500`.

### 5.3 States per surface

| Surface | Loading | Empty | Error | Notable success/warning |
|---------|---------|-------|-------|-------------------------|
| `/hr/staff` (Directory) | Skeleton table, 6 rows | "No staff yet. Add your first team member." + CTA | Banner with retry | Filtered-empty → "No match. Clear filters." |
| `/hr/leave` (Approval queue) | Skeleton list | "Inbox zero. No requests waiting." | Banner with retry | On approve: toast "Leave approved. Balance updated. Operations notified." Before approve when bookings overlap: inline warning "Overlaps with N confirmed bookings — Operations will flag them." |
| `/hr/me` (Mobile self-service) | Skeleton balance cards | "You're not linked to a staff record. Ask your HR Officer." | Banner with retry | Balance card: green when `available > 0`, neutral when `= 0`, red when `< 0` (data anomaly) |
| `/share/letter/[hash]` (Recipient sign) | PDF placeholder | n/a | "This link has expired or been revoked." | If already signed: show signed PDF + "Signed on <date>". On signing: "Thank you. Signed copy sent back to <business name>." |

### 5.4 Existing scaffold gap

Three placeholder pages exist (`<PillarStub>`): `app/(app)/hr/page.tsx`, `app/(app)/hr/employees/page.tsx`, `app/(app)/hr/leave/page.tsx`. This plan **renames** `employees` → `staff` (canonical noun matching the `staff_id` FK contract). The migration: delete `employees/page.tsx`, replace `page.tsx` + `leave/page.tsx` with real implementations, add all new routes per §5.1. The mobile `/hr/me/...` tree is entirely new.

---

## 6. Leave Management Logic

### 6.1 AL carry-forward rules (Malaysian standard, per-business configurable cap + expiry month)

Per `docs/v1-core-scope.md` line 98 and `docs/pillars/06-hr.md` §2.2, every business gets a configurable AL carry-forward rule. Defaults match the Malaysian Employment Act 1955 §60E(2) which guarantees a 12-month carry window unless the contract says otherwise.

Default seed values on business creation:

```ts
{
  carry_forward_enabled: true,                // AL only
  carry_forward_cap_multiplier: 1.5,          // max = 1.5 × annual entitlement
  carry_forward_expires_month: 3,             // forfeit at end of March (Q1 next year)
}
```

Owner-configurable on `/hr/leave` → settings drawer:

- **Cap multiplier** — `0` (no carry-forward, anything unused is forfeited immediately at year-end), `1.0` (full annual entitlement carries), `1.5` (default — generous), `2.0` (very generous), or custom decimal.
- **Expires month** — `null` (no expiry, carries indefinitely until used), or `1..12` (forfeit at end of that month in the new year).

### 6.2 MC vs AL vs unpaid distinction

| Type | `paid` | `counts_against_balance` | `requires_attachment` | Notes |
|------|-------:|-------------------------:|----------------------:|-------|
| `AL` | true | true | false | Standard annual leave. Subject to carry-forward. |
| `EL` | true | true | false | Emergency Leave. Counted against same calendar-year balance. Configurable per business (default 3 days/yr). |
| `MC` | true | true (separate MC balance) | true (the MC photo) | MC has its own balance row (`leave_type_id = MC`). Default 14 days/yr per Employment Act. |
| `UNPAID` | false | false | false | Always allowed; just creates the calendar block and the booking-conflict. |

The schema does not enforce these — the `leave_types` row does. This keeps reporting easy ("show me all paid leave taken last quarter") and lets future add-ons add new types without code changes.

### 6.3 Approval workflow + threshold rules

State machine for `leave_applications.status`:

```
                ┌──── cancel by submitter (only if pending) ──┐
                │                                              v
pending ──approve─→ approved ──cancel by HR/staff (before start) ──→ cancelled
   │                    │
   │                    └── (date range elapsed → no state change; row stays approved as history)
   └─reject─→ rejected
```

Approval thresholds (configurable per business in a future iteration; v1 ships fixed rules):

- **Self-approve** allowed when `total_days <= 0.5` AND `leave_type_code = 'AL'` AND user has `hr_officer` role themselves (rare edge — HR Officer applying for own half-day AL). Otherwise must be approved by another user.
- **Two-step approval** is **not** in v1. Single approver per application.
- **Anyone with `hasFullAccess('hr')`** (Owner / Manager / HR Officer) can approve.
- **Balance check at approval time**: if the application would push `available_days < 0` AND `leave_type_code in ('AL','EL','MC')`, surface a warning but allow the approval (owner discretion). For `UNPAID` no check.

### 6.4 Pseudo-code for carry-forward calc

Annual batch job runs January 1 (or configured year-rollover date) as Edge Function `supabase/functions/hr-carry-forward/index.ts`, invoked by Vercel Cron hitting `/api/cron/hr/carry-forward`.

```text
ALGORITHM annualCarryForward(business_id, year_just_ended):
  al_type = leave_types WHERE business_id = ? AND code = 'AL'
  FOR each staff IN active|probation|on_leave staff of business:
    prev = leave_balances WHERE staff_id, leave_type_id = al_type.id, leave_year = year_just_ended
    IF prev IS NULL: CONTINUE
    unused    = (prev.opening + prev.accrued) - prev.taken
    cap       = staff.annual_leave_entitlement_days * al_type.carry_forward_cap_multiplier
    carryable = MIN(MAX(unused, 0), cap)
    forfeited = MAX(unused - cap, 0)
    expires_on = al_type.carry_forward_expires_month
                   ? lastDayOfMonth(year_just_ended + 1, al_type.carry_forward_expires_month)
                   : NULL

    UPDATE prev SET carry_forward_out_days = carryable
    UPSERT new-year leave_balances row:
      opening_balance_days     = carryable
      accrued_days             = staff.annual_leave_entitlement_days
      carry_forward_in_days    = carryable
      carry_forward_expires_on = expires_on
    auditLog('hr.balance.carry_forward', { carryable, forfeited, cap, prev })
  END FOR
END
```

A second job runs on the expiry date (e.g. end of March) and forfeits any unused carried days:

```text
ALGORITHM expireCarryForward(business_id):
  FOR each balance WHERE carry_forward_expires_on = today AND carry_forward_in_days > 0:
    remaining = MAX(carry_forward_in_days - taken_days, 0)
    IF remaining > 0:
      UPDATE leave_balances SET opening_balance_days -= remaining
      auditLog('hr.balance.carry_forward_forfeit', { remaining })
  END FOR
END
```

EL and MC do **not** carry forward — they reset on year rollover.

---

## 7. State-Aware Public Holiday Calendar

### 7.1 Malaysian states + WP territories list

Code list, matching `businesses.state_code`:

| Code | Name |
|------|------|
| `FED` | Federal (applies to all states) |
| `KUL` | Wilayah Persekutuan Kuala Lumpur |
| `PJY` | Wilayah Persekutuan Putrajaya |
| `LBN` | Wilayah Persekutuan Labuan |
| `SGR` | Selangor |
| `JHR` | Johor |
| `PNG` | Pulau Pinang |
| `KDH` | Kedah |
| `KTN` | Kelantan |
| `TRG` | Terengganu |
| `PRK` | Perak |
| `NSN` | Negeri Sembilan |
| `MLK` | Melaka |
| `PHG` | Pahang |
| `PLS` | Perlis |
| `SBH` | Sabah |
| `SWK` | Sarawak |

### 7.2 Per-state seed strategy (curated annual table)

**Source of truth:** A JSON file `docs/data/holidays-MY-2026.json` (and one per future year) curated manually from the Public Holidays Act 1951 + the annual Cuti Umum gazette. Bundled into the repo so the app works offline and avoids depending on an unstable third-party API.

**Migration shape:** A seed migration `supabase/migrations/0000000000000X_hr_seed_holidays_2026.sql` reads the JSON via a Postgres `COPY` from a `tmp_holidays_2026` staging table (loaded by `supabase db push` from `supabase/seed/holidays-2026.csv` derived from the JSON). The next year (2027) ships a new migration.

**Lookup logic:** When the UI calls `GET /api/hr/holidays?from=...&to=...`, the handler does:

```sql
with effective as (
  select id, holiday_date, name, 'state' as source
  from public.public_holidays
  where state_code in ('FED', $1)  -- $1 = businesses.state_code
    and holiday_date between $2 and $3
    and not exists (
      select 1
      from public.business_holiday_overrides bho
      where bho.business_id = $4
        and bho.holiday_date = public_holidays.holiday_date
        and bho.override_type = 'suppress'
    )
  union all
  select id, holiday_date, coalesce(name, 'Override'), 'override'
  from public.business_holiday_overrides
  where business_id = $4
    and override_type in ('add', 'replace')
    and holiday_date between $2 and $3
)
select * from effective order by holiday_date;
```

### 7.3 Per-business overrides (replacement holidays / additional days)

Surface: `/hr/holidays` (desktop). Three actions per row:

- **+ Add Closure** — opens a small form, writes `override_type='add'`.
- **Hide for my business** — on a state row, writes `override_type='suppress'`.
- **Move to another day** — opens a date picker, writes `override_type='replace'` referencing the original `public_holidays.id`.

Each override emits `holiday.added` so Operations refreshes the booking calendar overlay.

### 7.4 Holiday-falling-on-weekend replacement rules

Malaysia's convention: when a federal public holiday falls on a Sunday (Saturday in Johor / Kedah / Kelantan / Terengganu), the **following working day** is gazetted as the replacement. The curated `holidays-MY-2026.json` includes these replacement rows pre-computed with `is_replacement = true`. The HR app does **not** auto-compute them — relying on the gazette removes ambiguity (the government sometimes shifts the replacement to a Tuesday for cluster days).

For businesses that operate a non-standard week (e.g. a homestay open 7 days), the owner uses the `business_holiday_overrides` `suppress` action to opt out of the replacement.

---

## 8. Onboarding Checklist

### 8.1 Template → instance pattern

The pattern mirrors a generic "template-clone-on-attach" — common across Admin (document templates), HR (this), and Operations (pipeline column presets):

1. Owner builds a template once: `onboarding_templates` + N `onboarding_template_tasks`. One template marked `is_default = true` per business.
2. On `POST /api/hr/staff` with `apply_default_onboarding = true`, the mutation:
   - Inserts `staff_onboarding_checklists` row pointing at the default template.
   - Copies every `onboarding_template_tasks` row into `staff_onboarding_tasks` with `due_on = staff.start_date + due_after_start_days`, and resolves `assignee_user_id` per §8.3.
3. If no default template exists (new business), the staff is created without a checklist. HR Officer can manually attach later via `POST /api/hr/onboarding/checklists`.

### 8.2 Task types (boolean / file upload / signature / data_entry)

| Type | UI affordance | Completion criteria |
|------|---------------|---------------------|
| `boolean` | Checkbox "Done" | Any user with permission can tick. |
| `file_upload` | Upload widget → Admin Storage | `evidence_file_id` populated. |
| `signature` | Opens the Admin digital-signature flow with a stub document (e.g. NDA template) | `evidence_file_id` populated (signed PDF). |
| `data_entry` | Small form with one or more typed fields (e.g. EPF number, SOCSO number) | `data_entry_value` jsonb populated; schema validated by Zod at write time. |

### 8.3 Assignee resolution (HR / Staff / Manager)

`assignee_role` on the template resolves at instance-creation time:

```ts
function resolveAssignee(args: {
  assignee_role: "hr_officer" | "manager" | "staff" | "owner";
  business_id: string;
  staff: Staff;
  supabase: SupabaseClient;
}): Promise<string | null> {
  switch (args.assignee_role) {
    case "staff":
      return args.staff.user_id;        // null if staff has no user account → task stays unassigned
    case "owner":
      return getFirstUserWithRole(args.business_id, "owner");
    case "manager":
      return getFirstUserWithRole(args.business_id, "manager")
          ?? getFirstUserWithRole(args.business_id, "owner");
    case "hr_officer":
      return getFirstUserWithRole(args.business_id, "hr_officer")
          ?? getFirstUserWithRole(args.business_id, "owner");
  }
}
```

If resolution returns `null` (e.g. staff has no login, no HR Officer hired yet), the row is created with `assignee_user_id = null` and surfaces in the HR Officer's "Unassigned tasks" panel.

### 8.4 Completion stamping

`PATCH /api/hr/onboarding/tasks/[id]/complete`:

1. Validates evidence per task_type.
2. Sets `status='done'`, `completed_at=now()`, `completed_by_user_id=current_user`.
3. Audits with `action='hr.onboarding.task_complete'`.
4. Checks whether all required tasks on the parent checklist are `done`. If yes:
   - Sets `staff_onboarding_checklists.status='completed'`, `completed_at=now()`.
   - Emits `onboarding.completed` event.
   - Writes audit `hr.onboarding.complete`.

---

## 9. Letter / PDF Generation

### 9.1 Library choice (`@react-pdf/renderer` if not in package.json — flag as new dep)

**Audit of `package.json`:** No PDF library is currently installed. Existing deps: `next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `clsx`, `lucide-react`, `tailwind-merge`, `zod`. None render PDFs.

**Proposal: add `@react-pdf/renderer@^4.0.0`** as a runtime dep.

- Pros: pure React API, server-side render via `renderToBuffer`, well-maintained, deterministic output.
- Cons: ~600 KB transitively; we only invoke it server-side from the `POST /api/hr/letters` route, so it never ships to the browser.

**Mitigation against bundle bloat:** ensure the PDF code path is only imported in route handlers (server bundle). Use a dynamic `await import("@react-pdf/renderer")` in `lib/hr/letters/render.ts` to keep tree-shaking clean.

**Flag explicitly in §13 Open Questions** so the user signs off before installation.

### 9.2 Template variables (employee name, IC, role, salary, start date, business signatory)

A letter body is Markdown with mustache `{{variable}}` substitution. Available variables, snapshotted at issue time into `staff_letters.variables`:

| Variable | Source |
|----------|--------|
| `{{employee_full_name}}` | `staff.full_name` |
| `{{employee_preferred_name}}` | `staff.preferred_name` |
| `{{employee_ic}}` | decrypted `staff.ic_number_ciphertext` |
| `{{employee_role}}` | `staff.role_title` |
| `{{employee_employment_type}}` | `staff.employment_type` |
| `{{employee_start_date}}` | `staff.start_date` (formatted `D MMMM YYYY`) |
| `{{employee_end_date}}` | `staff.end_date` (termination letters only) |
| `{{employee_salary_myr}}` | `staff.base_salary_myr` (formatted `RM X,XXX.00`) |
| `{{employee_bank_name}}` | `staff.bank_name` |
| `{{employee_bank_account}}` | decrypted `staff.bank_account_ciphertext` |
| `{{business_name}}` | `businesses.name` |
| `{{business_idcompany}}` | `businesses.idcompany` |
| `{{signatory_name}}` | `letter_templates.signatory_name` |
| `{{signatory_title}}` | `letter_templates.signatory_title` |
| `{{issued_date}}` | `now()` formatted |

Additional `variable_overrides` from the issue payload merge on top, so the owner can fill remaining fields (e.g. probation period length) without re-editing the template.

### 9.3 Storage in Supabase Storage with signed URLs

- Bucket: `hr-letters` (private; one bucket per pillar in the existing convention).
- Path: `{business_id}/{staff_id}/{staff_letter_id}.pdf`.
- Signed PDF path: `{business_id}/{staff_id}/{staff_letter_id}-signed.pdf` (set by Admin signature flow on completion).
- Signed URLs for downloads expire after 24 hours; the `GET /api/hr/letters/[id]/pdf` route regenerates fresh URLs on every request.

### 9.4 Letter types in v1 (offer, confirmation, salary adjustment, termination)

Per `docs/pillars/06-hr.md` §2.5, v1 ships three templates. This plan adds a fourth — `salary_adjustment` — because the Confirmation letter pattern naturally extends to it and `staff_employment_history` already tracks salary changes; surfacing a letter is a tiny delta.

| Type | Default body (sketch) | Trigger |
|------|-----------------------|---------|
| `offer` | "Dear {{employee_full_name}}, we are pleased to offer you the position of {{employee_role}}…" | Pre-hire, before staff is created (owner may issue then create staff after acceptance — or issue post-creation). |
| `confirmation` | "Dear {{employee_full_name}}, following your probation, we are pleased to confirm…" | Status `probation → active`. |
| `salary_adjustment` | "Dear {{employee_full_name}}, your monthly base salary will be revised to {{employee_salary_myr}}…" | After `staff_employment_history.change_type='salary_adjustment'` row. |
| `termination` | "Dear {{employee_full_name}}, this letter confirms that your employment with {{business_name}} will end…" | Status `active → terminated/resigned`. |

The Confirmation Letter only makes sense post-probation; the UI surfaces it on the staff profile as a CTA only when `staff.status` was previously `probation` and is now `active`.

---

## 10. Permissions

### 10.1 Per-surface mapping against `lib/permissions.ts`

The HR pillar already has Owner / Manager / HR Officer with `hr: "*"`, and Staff with `hr: { leave: "self_only" }`. To support the new surfaces, this plan **extends** the staff role's HR scope and codifies the surface keys:

```ts
// proposed update to lib/permissions.ts (NOT in this pass — flagged in §13 OQs)
staff: {
  admin: { tasks: "assigned_only" },
  hr: {
    leave: "self_only",
    employees: "self_only",
    onboarding: "self_only",
    letters: "self_only",
  },
  // …
},
hr_officer: {
  admin: { storage: "rw_hr_docs_only" },
  hr: "*",                       // unchanged
  // …
},
```

The surface keys map 1:1 with `<RequirePermission area="hr" surface="...">` calls in the page components.

### 10.2 Surface × role matrix

| Surface | Owner | Manager | HR Officer | Accountant | Cashier | Staff |
|---------|:-----:|:-------:|:----------:|:----------:|:-------:|:-----:|
| `hr.employees` (staff list, others' profiles) | RW | RW | RW | — | — | self only (own profile) |
| `hr.employees` (own profile read) | RW | RW | RW | — | — | R |
| `hr.leave` (approval queue, others' apps) | RW | RW | RW | — | — | — |
| `hr.leave` (apply for self) | RW | RW | RW | — | — | RW |
| `hr.leave` (own balance + history) | RW | RW | RW | — | — | R |
| `hr.holidays` | RW | RW | RW | — | — | R |
| `hr.onboarding` (template editor) | RW | RW | RW | — | — | — |
| `hr.onboarding` (own tasks) | — | — | — | — | — | RW |
| `hr.letters` (template editor, issue) | RW | RW | RW | — | — | — |
| `hr.letters` (own letters list / download) | — | — | — | — | — | R |
| `/share/letter/[hash]` | public (hash-gated) | — | — | — | — | — |

### 10.3 RLS posture — critical "self vs all" pattern

The single most important RLS pattern in HR is **self_only vs all**: Staff sees only their own rows; HR Officer / Owner / Manager sees everything in the business.

**Encryption helper** (used by both directions):

```sql
create or replace function public.hr_encrypt(business_id uuid, plaintext text)
returns bytea
language sql
security definer
set search_path = public, extensions
as $$
  select pgp_sym_encrypt(plaintext, public.business_kek(business_id))
$$;

create or replace function public.hr_decrypt(business_id uuid, ciphertext bytea)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select pgp_sym_decrypt(ciphertext, public.business_kek(business_id))
$$;
```

`public.business_kek(business_id)` fetches a per-business symmetric key from Supabase Vault (a Phase 0 helper to add). Application code never sees the KEK.

**Self-vs-all policies for `staff`:**

```sql
-- Read: HR Officer / Owner / Manager see all rows in their business; Staff see only own.
create policy "staff_select_self_or_full_access"
  on public.staff for select
  using (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager', 'hr_officer')
      or user_id = auth.uid()
    )
  );

-- Insert / Update: only HR Officer / Owner / Manager.
create policy "staff_insert_full_access_only"
  on public.staff for insert
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy "staff_update_full_access_only"
  on public.staff for update
  using (business_id = public.current_business_id())
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
-- No DELETE policy — staff are never hard-deleted in v1; termination is an UPDATE.
```

**Self-vs-all for `leave_applications`:** same `SELECT` shape as `staff` (HR full-access role OR `staff_id ∈ (select id from staff where user_id = auth.uid())`). Two write policies:

```sql
-- Apply / approve / reject: HR full access OR self-apply (insert only when staff_id is self).
create policy "leave_applications_insert_self_or_full_access"
  on public.leave_applications for insert
  with check (
    business_id = public.current_business_id()
    and (
      public.current_role() in ('owner', 'manager', 'hr_officer')
      or staff_id in (select id from public.staff where user_id = auth.uid())
    )
  );

-- Update: HR full access can change to any status. Submitter can only update own pending → cancelled.
create policy "leave_applications_update_full_access"
  on public.leave_applications for update
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

create policy "leave_applications_cancel_self"
  on public.leave_applications for update
  using (
    business_id = public.current_business_id()
    and staff_id in (select id from public.staff where user_id = auth.uid())
    and status = 'pending'
  )
  with check (status = 'cancelled');
```

**`staff_letters`** mirrors the `leave_applications` pattern: read = self-or-full-access, insert = full-access only (HR Officer / Owner / Manager).

**`public_holidays`** is global-read for authenticated users; writes are blocked at the RLS layer (only the service role inserts via seed migrations):

```sql
alter table public.public_holidays enable row level security;
create policy "public_holidays_select_all_authenticated"
  on public.public_holidays for select to authenticated using (true);
-- No insert/update/delete policies → blocked by default for non-service-role callers.
```

`business_holiday_overrides`, `onboarding_templates`, `onboarding_template_tasks`, `staff_employment_history`, `leave_types`, `leave_balances`, and `letter_templates` all follow the standard pattern: `business_id = current_business_id()` for SELECT; full-access role gate on INSERT/UPDATE/DELETE.

---

## 11. Testing Strategy

The repo uses **Vitest** (already in devDependencies). All tests live next to their source file (`*.test.ts`) except RLS tests which live under `supabase/tests/`.

### 11.1 Unit tests

| Test | Subject | Key cases |
|------|---------|-----------|
| `lib/hr/leave/carry-forward.test.ts` | `computeCarryForward(prevBalance, entitlement, cap)` | Cap = 1.5×; cap = 0; cap = ∞; unused = 0; unused < 0 (over-taken — clamp to 0); cap fractional days |
| `lib/hr/leave/balance.test.ts` | `availableDays(balance)` and `forfeitedDays(balance)` | Past-expiry carry-forward; mid-year mid-leave; partial half-day usage |
| `lib/hr/holidays/lookup.test.ts` | `getEffectiveHolidays(business, from, to)` | State + FED merging; suppress override; replace override; add override; date range partial |
| `lib/hr/holidays/working-days.test.ts` | `countWorkingDays(holidays, start, end, halfStart, halfEnd)` | Spans weekend; spans PH; half-day at both ends; same-day request |
| `lib/hr/letters/render.test.ts` | `substituteVariables(template, vars)` | Missing variable falls back to empty string + emits warning; nested mustaches are not supported and throw |
| `lib/hr/onboarding/resolver.test.ts` | `resolveAssignee` | Fallback chain when role missing |

### 11.2 RLS tests (especially self-vs-all on staff / leave / letters)

Under `supabase/tests/hr-rls.test.sql`, run via `supabase test db`. Test plan:

1. Seed 2 businesses (A, B), each with 1 owner, 1 hr_officer, 2 staff (S1 with `users` row, S2 without).
2. Acting as B's owner, assert: zero rows visible from any HR table for business A.
3. Acting as A's hr_officer, assert: all rows from A visible; insert succeeds; update succeeds.
4. Acting as A's staff S1, assert:
   - Can SELECT own row from `staff`; cannot SELECT others'.
   - Can INSERT into `leave_applications` for own `staff_id`; cannot for others'.
   - Can UPDATE own pending leave to `cancelled`; cannot UPDATE to `approved`.
   - Can SELECT own rows from `staff_letters`; cannot insert.
5. Acting as A's staff S1, attempt to spoof `business_id` to B's id on insert → check rejection.

### 11.3 API integration tests

`app/api/hr/**/*.test.ts` using Vitest + a fetch wrapper that hits the Next route handler. Coverage:

- Full happy path: create staff → checklist instantiated → seed balances → emit `staff.created`.
- Leave apply → approve → balance decrement → `leave.approved` emitted → audit row written. All in one transaction. Roll back on synthetic failure mid-flow; assert nothing leaked.
- MC apply without attachment → 400 with Zod error.
- Termination → `staff.deactivated` + history row + status flip in one transaction.
- Letter issue → PDF buffer length > 0 → row in `staff_letters` → `letter.issued` emitted → share hash uniqueness.
- Holiday override `add` → `holiday.added` emitted → effective lookup returns the new date.

### 11.4 Event-bus integration tests

`lib/events/__tests__/hr-fanout.test.ts`. After Phase 0's dispatcher exists, simulate:

- `staff.created` → assert Sales / Operations / Marketing dropdown-cache-invalidation handler ran once per pillar.
- `leave.approved` → assert Operations' `staff_availability_blocks` row exists for the range.
- `leave.cancelled` after `leave.approved` → assert the same block row was removed (idempotent on `leave_application_id`).
- Replay test: dispatch `leave.approved` twice with same `id` → only one block row exists.

### 11.5 Component tests

Using Vitest + `@testing-library/react` (to be added). Sketch:

- `LeaveApplyForm`: MC type shows attachment input; AL doesn't.
- `LeaveApprovalQueue`: pending count badge updates after approval action.
- `HolidayCalendarEditor`: clicking a state row's "Move" opens the date-picker dialog.
- `LetterIssueDialog`: selecting `confirmation` greys out salary fields; selecting `salary_adjustment` requires a new salary value.

### 11.6 CI gate

Add to GitHub Actions (existing `lint` + `type-check` + `test` already wired per `package.json` scripts):

- Lint, type-check, unit + integration tests required to pass on PR.
- RLS test job runs against `supabase start` + `supabase db reset` + `supabase test db` — gated to PRs touching `supabase/` or HR pillar files.

---

## 12. Implementation Milestones

Each milestone lists deliverables, blockers, and a Definition of Done.

### M1 — Schema + RLS + RBAC

**Deliverables:** Migrations `0...10_hr_init.sql` (§2.2–2.12 tables + RLS), `0...11_hr_seed_holidays_2026.sql`, `0...12_hr_seed_leave_types_trigger.sql`. `lib/events/hr-payloads.ts` + extended `EventName` union. `lib/hr/mutations.ts` with `createStaff`, `applyLeave`, `approveLeave`, `rejectLeave`, `cancelLeave`. RLS tests for self-vs-all on `staff` and `leave_applications` green.
**Blockers:** `lib/events/emit.ts` and `lib/audit/log.ts` from Admin (else stub with feature flag).
**DoD:** Owner can `INSERT` into `staff` via authenticated Supabase session, sees the row back, `events_outbox` contains a `staff.created` row. RLS tests + type-check green.

### M2 — Staff directory CRUD + employment history (desktop)

**Deliverables:** `/hr/staff` with `StaffDirectoryTable` + filter chips + CSV export. `/hr/staff/[id]` with `StaffProfileCard`, `EmploymentHistoryTimeline`, action menu. `StaffFormDialog` with `IcInput` + `EncryptedFieldDisplay`. Server Actions wrap mutations.
**Blockers:** none beyond M1.
**DoD:** HR Officer creates a staff, edits role_title (history row appears in timeline), terminates (status flips, `staff.deactivated` event in outbox). Integration test green.

### M3 — Leave self-service mobile + desktop approval queue

**Deliverables:** `/hr/me`, `/hr/me/leave/new`, `/hr/me/leave/[id]` mobile routes. `/hr/leave` desktop approval queue + `/hr/leave/calendar`. Half-day support in `LeaveApplyForm`. MC attachment upload wired to Admin Storage (feature-flag fallback).
**Blockers:** Admin Storage upload helper for MC photos.
**DoD:** Staff with `user_id` opens `/hr/me`, sees AL/EL/MC balance cards, applies for AL. HR Officer approves on `/hr/leave`; balance updates; `leave.approved` emitted; audit row written.

### M4 — Public holiday calendar + state seed + carry-forward Edge Function

**Deliverables:** `/hr/holidays` editor. `GET /api/hr/holidays` + `business_holiday_overrides` CRUD. `supabase/functions/hr-carry-forward/index.ts` + Vercel Cron entry. `lib/hr/leave/working-days.ts`.
**Blockers:** Operations consumer for `holiday.added` (HR just emits).
**DoD:** New business defaults to its `state_code` holiday list; owner can add / suppress / replace overrides; carry-forward Edge Function dry-run shows correct numbers for the test fixture; first cron run produces audit rows.

### M5 — Onboarding checklist (templates + per-staff instances)

**Deliverables:** `/hr/onboarding/templates` editor with `OnboardingTemplateBuilder` (reorderable). Auto-instantiation hook in `createStaff`. Per-staff view at `/hr/staff/[id]/onboarding`. Mobile view `/hr/me/onboarding`. File upload / signature task types wired to Admin Storage + signature flow.
**Blockers:** Admin digital-signature flow for `signature` task type — feature-flag fallback.
**DoD:** Owner builds default template with 5 mixed-type tasks; new staff auto-gets checklist with resolved assignees + due dates; completing all required tasks emits `onboarding.completed` + audit row.

### M6 — Letter template editor + PDF generation + storage

**Deliverables:** Add `@react-pdf/renderer` (after sign-off per §13). `/hr/letters/templates` editor. `/hr/staff/[id]/letters` history + `LetterIssueDialog`. `lib/hr/letters/render.ts` (server-only). `POST /api/hr/letters` emitting `letter.issued`. Storage bucket `hr-letters` + signed-URL helper. Share-hash uniqueness with retry.
**Blockers:** Admin digital-signature flow for `/share/letter/[hash]`.
**DoD:** HR Officer issues an Offer letter; PDF downloads correctly; share URL renders a preview unauthenticated; signature round-trip writes back `signed_pdf_storage_path` and `signed_at`.

### M7 — Cross-pillar event consumers + tests + verification

**Deliverables:** With Operations: `leave.approved` handler writing `operations.staff_availability_blocks` rows. With Sales / Operations / Marketing: `staff.created` / `staff.deactivated` consumers refresh dropdown caches. Event-bus integration tests (§11.4). E2E manual verification script.
**Blockers:** Operations pillar `staff_availability_blocks` table.
**DoD:** Cross-pillar tests green. Manual run reproduces the booking-block behavior in dev.

### Milestone sequencing chart

```
M1 ─┬─→ M2 ─┬─→ M3 ─┬─→ M4 ─┬─→ M5 ─┬─→ M6 ─┬─→ M7
    │       │       │       │       │       │
    │       │       │       │       │       └─ depends on Admin digital-signature
    │       │       │       │       └─ depends on Admin Storage + signature
    │       │       │       └─ depends on Operations holiday-overlay consumer (optional for M4 close)
    │       │       └─ depends on Admin Storage (MC upload)
    │       └─ depends on M1 only
    │
    └─ depends on Admin audit-log helper + events outbox helper
```

M1 → M3 are the critical path for "owner can use HR for the first time". M4–M6 layer in the harder integrations. M7 is the cross-pillar consolidation pass.

---

## 13. Open Questions for the User

1. **Confirm the `@react-pdf/renderer` add.** It's not in `package.json`; we'll need it for letters. Any preference for an alternative (e.g. server-side `puppeteer` for a richer HTML→PDF path, accepting a heavier binary)?
2. **Per-business KEK in Supabase Vault.** Should HR depend on a new Phase 0 `public.business_kek(business_id)` helper, or use a single platform-wide KEK with per-row salt? The first is more secure but adds Vault complexity.
3. **`staff_no` format.** Auto-incremented per business (`S001`, `S002`)? Or owner-chosen string? Auto-increment simplifies the self-service URL in the add-on.
4. **EL default annual entitlement.** Malaysian Employment Act doesn't mandate EL; many SMEs give 3 days. Use 3 as the seed default?
5. **Carry-forward expiry month.** Q1 (default March) is the common choice; some prefer June or no expiry. Confirm 3 as default.
6. **Permission for Manager vs HR Officer on letters.** Should issuing a Termination letter require Owner-only (extra safety) rather than `hasFullAccess('hr')`?
7. **Operations leave-block behavior.** Should `leave.approved` auto-cancel conflicting bookings, or only flag for owner review? This plan picks "flag only". Confirm.
8. **Staff with no `users` row** — should we ship a "promote to login user" CTA in v1 (sends Supabase magic link), or defer to a Team-management add-on? This plan defers.

---

## Appendix A — File paths the next pass will touch

```
docs/data/holidays-MY-2026.json                             NEW (curated)

supabase/
  migrations/
    00000000000010_hr_init.sql                              NEW (§2.2–2.12, RLS, triggers)
    00000000000011_hr_seed_holidays_2026.sql                NEW (§7.2)
    00000000000012_hr_seed_leave_types_trigger.sql          NEW
    00000000000013_hr_letter_storage_bucket.sql             NEW
  seed/holidays-2026.csv                                    NEW
  functions/hr-carry-forward/index.ts                       NEW
  tests/hr-rls.test.sql                                     NEW

lib/
  events/{types.ts EDIT, hr-payloads.ts NEW, emit.ts NEW(Phase 0)}
  audit/log.ts                                              NEW (Admin owns; HR consumes)
  hr/
    schemas.ts, mutations.ts, encryption.ts                 NEW
    leave/{carry-forward,balance,working-days}.ts (+ .test) NEW
    holidays/lookup.ts (+ .test)                            NEW
    onboarding/{resolver,instantiate}.ts (+ resolver.test)  NEW
    letters/{render,variables}.ts (+ render.test)           NEW
  permissions.ts                                            EDIT (extend staff hr scope; §10.1)

app/api/hr/
  staff/{route.ts, [id]/route.ts, [id]/employment-history/route.ts}
  leave-types/{route.ts, [id]/route.ts}
  leave/{balances/route.ts, applications/route.ts,
         applications/[id]/{approve,reject,cancel}/route.ts}
  holidays/route.ts · holiday-overrides/{route.ts, [id]/route.ts}
  onboarding/{templates/route.ts, templates/[id]/route.ts,
              checklists/[staffId]/route.ts, tasks/[id]/complete/route.ts}
  letters/{templates/route.ts, templates/[id]/route.ts,
           route.ts, [id]/route.ts, [id]/pdf/route.ts}
app/api/cron/hr/carry-forward/route.ts                      NEW

app/(app)/hr/
  page.tsx                                                  EDIT (replace stub)
  employees/page.tsx                                        DELETE (renamed → staff)
  staff/{page.tsx, [id]/page.tsx, [id]/letters/page.tsx,
         [id]/onboarding/page.tsx}                          NEW
  leave/{page.tsx EDIT, calendar/page.tsx NEW}
  holidays/page.tsx · onboarding/templates/page.tsx
    · letters/templates/page.tsx                            NEW
  me/{page.tsx, leave/new/page.tsx, leave/[id]/page.tsx,
      onboarding/page.tsx}                                  NEW (mobile)
app/share/letter/[hash]/page.tsx                            NEW (public)

components/hr/
  staff-directory-table, staff-profile-card, staff-form-dialog,
  employment-history-timeline, leave-approval-queue, leave-calendar,
  leave-balance-card, leave-apply-form, holiday-calendar-editor,
  onboarding-template-builder, onboarding-task-row,
  letter-template-editor, letter-issue-dialog, letter-recipient-signer,
  ic-input, encrypted-field-display                         NEW

package.json                                                EDIT (add @react-pdf/renderer)
```

## Appendix B — Events HR touches

**Emitted (new in HR pass — needs adding to `lib/events/types.ts`):**

- `staff.created`
- `staff.updated`
- `staff.deactivated`
- `staff.role_changed`
- `leave.applied`
- `leave.cancelled`
- `letter.issued`
- `onboarding.completed`
- `holiday.added`

**Emitted (already in `lib/events/types.ts`):**

- `leave.approved`
- `leave.rejected`

**Reserved but NOT emitted in v1 (already in `lib/events/types.ts`):**

- `payroll.approved` — kept in the union for forward compatibility but no HR v1 code path emits it. Statutory Payroll add-on (future) will fire it.

**Consumed:**

- `task.due_soon` (Admin) — surfaced in HR Officer's dashboard "Action needed" panel when the task originates from `staff_onboarding_tasks`.

## Appendix C — Schema cheat sheet

```
businesses (Phase 0)
  └── staff
        ├── staff_employment_history (1:N append-only)
        ├── leave_balances (1:N per type per year)
        ├── leave_applications (1:N)
        ├── staff_onboarding_checklists (1:1 active)
        │     └── staff_onboarding_tasks (1:N)
        └── staff_letters (1:N)
                └── share_hash → /share/letter/[hash]

  └── leave_types (4 seeded: AL, EL, MC, UNPAID)
  └── onboarding_templates
        └── onboarding_template_tasks
  └── letter_templates
  └── business_holiday_overrides → public_holidays (global)

public_holidays (global, no business_id)
```

## Appendix D — Malaysian state holiday matrix (skeleton — full seed in M4)

**Federal (apply to all states unless noted):** New Year's Day (1 Jan; not KTN/TRG/JHR/KDH) · Federal Territory Day (1 Feb; KUL/PJY/LBN only) · Chinese New Year (2 days, variable) · Labour Day (1 May) · Wesak Day (variable) · Agong's Birthday (1st Mon of June) · Hari Raya Aidilfitri (2 days) · Hari Raya Haji (1 day federally, 2 in KTN/TRG/KDH/PLS) · Awal Muharram · Maulidur Rasul · Merdeka Day (31 Aug) · Malaysia Day (16 Sep) · Deepavali (not SWK) · Christmas (25 Dec).

**State-specific (non-exhaustive — full list in `holidays-MY-2026.json`):**

| State | Key state-specific days |
|-------|-------------------------|
| `JHR` | Sultan of Johor's Birthday, Hari Hol; **weekend = Fri+Sat** |
| `KDH` | Sultan of Kedah's Birthday, Hari Raya Aidiladha (2 days); **Fri+Sat** |
| `KTN` | Sultan of Kelantan's Birthday (2 days); **Fri+Sat** |
| `MLK` | Yang di-Pertua's Birthday, Declaration of Historical City |
| `NSN` | Yang di-Pertuan Besar's Birthday |
| `PHG` | Sultan of Pahang's Birthday (2 dates), Hol Almarhum Sultan Ahmad Shah |
| `PNG` | Penang Governor's Birthday, George Town Heritage Day, Thaipusam |
| `PRK` | Sultan of Perak's Birthday |
| `PLS` | Raja of Perlis's Birthday; **Fri+Sat** |
| `SBH` | Pesta Kaamatan (2 days), Governor's Birthday, Christmas Eve (half-day) |
| `SGR` | Sultan of Selangor's Birthday, Thaipusam |
| `SWK` | Gawai Dayak (2 days), Governor's Birthday, Sarawak Day |
| `TRG` | Sultan of Terengganu's Birthday (2 dates), Anniversary of Installation; **Fri+Sat** |
| `KUL` / `PJY` | Thaipusam · `LBN` Pesta Kaamatan |

The Fri+Sat-weekend states (JHR/KDH/KTN/TRG) require `lib/hr/leave/working-days.ts` to respect `businesses.workweek_pattern` (new field, default `mon-fri`) — captured under §13 OQ.
