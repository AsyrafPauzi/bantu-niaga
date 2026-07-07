# HR Core — Phase 1 Design

> **Status:** Draft for owner review — 2026-07-07  
> **Scope rule:** Anything **not** listed in the owner brief for Phase 1 moves to **Phase 2+** (after core modules land).

---

## 1. Goals

Finish the **daily HR loop** for Malaysian micro-SMEs: employees, documents, onboarding, limited leave balances, public holidays (free add-on), and safer sensitive data — without building payroll, roster, or paid automation yet.

**Non-goals (Phase 1):** Operations booking blocks, event outbox fan-out, staff login portal, paid add-on logic beyond placeholders, AL carry-forward automation.

---

## 2. Concepts (answers to your questions)

### 2.1 What is “state-aware federal”?

Malaysia has two layers of public holidays:

| Layer | Example | Who it applies to |
|-------|---------|-------------------|
| **Federal (national)** | Hari Merdeka, Labour Day, Hari Raya (when gazetted nationally) | Every state |
| **State / FT** | Sultan’s birthday (Selangor), Thaipusam (selected states), Kaamatan (Sabah) | Only that state or federal territory |

**State-aware** means: when we import holidays, we fetch **federal holidays + holidays for the company’s state** (from `businesses.state_code` in Settings), not every state in Malaysia.

Example: a business in **Selangor** gets Merdeka (federal) + Selangor-specific days, but not Sabah-only holidays.

### 2.2 What are per-business overrides?

Official calendar ≠ how every company operates. Overrides let an owner adjust **their** calendar without changing the national list:

| Override | Use case |
|----------|----------|
| **Add closure** | Company off-day (e.g. annual dinner eve, branch shutdown) |
| **Hide / suppress** | State holiday but shop still open — don’t block leave |
| **Replace / move** | Observe replacement day on a different date than gazette |

**Phase 1:** explain in UI help text only; **build overrides in Phase 2** (needs `business_holiday_overrides` table).

---

## 3. Phase 1 — In scope (owner confirmed)

### 3.1 Onboarding checklist

**What:** Wire existing API + components into the product.

| Item | Detail |
|------|--------|
| Employee profile | Section: checklist items, add task, mark done |
| New employee | Optional “Add default onboarding items” (3–5 seed labels: IC collected, bank details, contract signed, uniform, SOP briefing) |
| HR overview | KPI or list: open onboarding items across team |
| Data | Keep `hr_onboarding_items` (no template engine in Phase 1) |

### 3.2 Public holiday calendar (free Marketplace add-on)

**Add-on:** `hr-public-holidays` (already seeded, RM 0, activate/deactivate).

**Auto-import (Phase 1):**

1. Owner activates free add-on + business has `state_code` in Settings.
2. **Import** button on `/hr/holidays` (and first-time prompt): “Import 2026 holidays for Selangor”.
3. Server calls external API (see §4.1), upserts into `hr_public_holidays` for tenant.
4. Store `imported_at`, `source`, `year` in row meta or dedicated columns.
5. Re-import is idempotent (same date + name + state → skip or update).
6. Daily notice + Hana only mention holidays when add-on **active** (already implemented).

**Not Phase 1:** per-business overrides, Operations booking block, iCal feed.

### 3.3 Leave balances & policy — **limited core**

**Core (free, no add-on):**

| Feature | Behaviour |
|---------|-----------|
| Default AL entitlement | One number per employee (default **8 days**/year; editable on profile) |
| Balance display | `entitlement − approved days taken this calendar year` for AL only |
| On approve | Increment `taken` for date range (working days only optional v1 — **calendar days** is simpler for Phase 1) |
| EL / MC | Track **records only** — no balance cap in core |
| UI | Employee profile + leave record sidebar: “AL: 3 of 8 used” |
| Validation | Warn (not hard block) if approving AL exceeds balance — owner can still approve |

**Schema (minimal):**

```sql
-- on hr_employees
annual_leave_entitlement_days numeric(5,1) not null default 8

-- new table
hr_leave_balances (
  business_id, employee_id, leave_year smallint,
  entitlement_days, taken_days,
  unique (employee_id, leave_year)
)
```

Tally updates on leave **approve** / **reject** (revert taken).

### 3.4 Document UX

| Item | Detail |
|------|--------|
| Download | Employee profile document list → signed URL link (Admin Storage) |
| Staff document folder | New page `/hr/documents` — all staff docs, filter by employee / type (IC, bank, contract, MC) |
| Upload | Keep existing upload on employee profile |

### 3.5 Security hardening (Phase 1 — required)

| Item | Approach |
|------|----------|
| IC / bank fields | App-level AES-256-GCM (reuse `lib/integrations/crypto.ts` pattern) or column migration to ciphertext + server-only decrypt in HR routes |
| Audit trail | New `lib/audit/log.ts` → insert `audit_log` on HR create/update/delete (employee, leave, document, onboarding, holiday import) |
| API responses | Never return decrypted IC/bank to client unless HR role; mask in lists (`****1234`) |
| RLS | Unchanged — HR roles only |

**Deferred (post all modules):** `lib/events/emit.ts` outbox, cross-pillar fan-out.

### 3.6 Staff self-service

**Phase 1:** Share link to leave form only (existing). No `/hr/me` login.

### 3.7 Marketplace — “Coming soon” placeholders

Seed or update catalog rows; Marketplace card shows **Coming soon** (no activate, or activate disabled with tooltip).

| Slug (suggested) | Name | Pillar | Price (placeholder) |
|------------------|------|--------|---------------------|
| `hr-advanced-leave-policy` | Advanced Leave Policy | hr | RM 29/mo |
| `hr-contract-letters` | Contract & Letter Generator | hr | RM 39/mo |
| `hr-shift-roster` | Shift Roster | hr | RM 49/mo |
| `hr-time-clock` | Time Clock | hr | RM 39/mo |
| `hr-payroll-pack` | Payroll & Statutory Pack | hr | RM 99/mo |
| `hr-reminder-pack` | HR Reminder Pack | hr | RM 19/mo |
| `hr-staff-portal` | Staff Self-Service Portal | hr | RM 29/mo |

Consolidate duplicate `holiday-calendar-sync` → deprecate in favour of `hr-public-holidays` (migration update).

### 3.8 HR Assistant (Hana) — polish

| Item | Detail |
|------|--------|
| Suggested prompts | Pills: “Who is on leave today?”, “Pending leave?”, “Next holiday?” (if add-on on) |
| Smarter replies | Include leave balance in briefing when core balance exists |
| Tool guardrails | Refuse approve if no pending; mention balance when approving AL |
| Settings | Already have name + daily notice toggles |

---

## 4. Technical choices

### 4.1 Holiday API (free source)

**Recommended primary:** [MyCal Malaysia Calendar API](https://mycal-web.pages.dev/) (open source, federal + state, cuti ganti).

```
GET https://mycal-api.huijun00100101.workers.dev/v1/holidays?year=2026&state=selangor
GET /v1/states/resolve?alias=KUL
```

**Implementation:**

- `lib/hr/holiday-import.ts` — map `businesses.state_code` (e.g. `SGR`) → API alias (`selangor`)
- Server-only fetch from `POST /api/hr/holidays/import`
- On failure: user-friendly error; optional fallback to bundled `docs/data/holidays-MY-YYYY.json` (curated backup, ship 2026 in repo)
- Rate limit: one import per business per hour
- No API keys required for MyCal

**Alternative (backup):** Calendarific (free tier, API key) — only if MyCal unavailable.

### 4.2 Add-on: Advanced Leave Policy (paid — Phase 2 build, Phase 1 placeholder only)

Suggested **extended** features when customer pays:

| Feature | Description |
|---------|-------------|
| AL carry-forward | Year-end job: unused AL → next year, capped (e.g. 1.5× entitlement) |
| Carry-forward expiry | Forfeit unused carried days after March 31 |
| Per-type policies | Custom EL/MC limits, attachment rules, probation rules |
| Pro-rated entitlement | Join mid-year → auto prorate AL |
| Unpaid leave type | Track separately |
| Block over-approval | Hard stop when AL exceeds balance (configurable) |
| Leave calendar view | Team calendar with balances |
| Policy reports | Export leave summary per employee / year |

**Core vs paid boundary:** Core = single entitlement number + simple taken tally. Paid = rules engine + automation + hard enforcement + reports.

---

## 5. Phase 2+ (explicitly later)

| Item | When |
|------|------|
| Staff login self-service (`/hr/me`) | After core modules; paid add-on `hr-staff-portal` |
| Per-business holiday overrides | Phase 2 |
| Operations integration (block bookings on PH) | After Operations core + events outbox |
| Cross-pillar events (`leave.approved` → Ops) | After all module cores |
| Paid add-on **functionality** (not placeholders) | After core modules stable |
| AL carry-forward automation | With `hr-advanced-leave-policy` add-on |
| Contract/letter generator, payroll, roster, time clock, reminders | Marketplace add-ons, coming soon → build in Phase 2+ |

---

## 6. Phase 1 delivery order

Recommended sequence (each step shippable):

```
1. Security foundation     — audit helper + field encryption migration
2. Onboarding UI           — employee page + overview widget
3. Limited leave balances  — schema + approve hook + UI
4. Document download       — signed URLs on profile
5. Staff document folder   — /hr/documents page
6. Holiday auto-import     — API client + import route + UI button
7. Marketplace placeholders — coming soon cards + slug cleanup
8. Hana polish             — pills + balance/holiday in briefing
9. Tests + type-check
```

**Estimated effort:** 5–7 dev days (one engineer).

---

## 7. Acceptance criteria (Phase 1)

- [ ] Owner can add onboarding tasks on employee profile and mark complete
- [ ] Owner sees incomplete onboarding on HR overview
- [ ] AL balance shows on employee profile; updates on approve/reject
- [ ] IC/bank encrypted at rest; audit rows on HR mutations
- [ ] Documents downloadable; `/hr/documents` lists all staff files
- [ ] With holiday add-on on + state set, Import fills calendar from API
- [ ] Paid HR add-ons show “Coming soon” in Marketplace
- [ ] Hana suggests quick prompts and mentions balance/holidays when relevant
- [ ] Share-link leave form still works (no staff login)

---

## 8. Decisions (approved 2026-07-07)

1. **State-aware import:** Yes — MyCal API fetches federal + company state holidays.
2. **AL days counted:** Working days excluding weekends and public holidays (from tenant calendar).
3. **Over balance:** Soft warning on approve; still allowed.
4. **Holiday API:** MyCal primary + curated `docs/data/holidays-MY-YYYY.json` fallback.
5. **Encryption:** App-level AES-256-GCM via existing `INTEGRATION_ENCRYPTION_KEY`; sealed JSONB columns; plaintext cleared on write; decrypt only on detail reads (lists never touch sealed fields).

**Status:** Approved — implementation in progress.
