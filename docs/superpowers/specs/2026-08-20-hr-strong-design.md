# HR Strong (Solo+) — Design Spec

**Date:** 2026-08-20  
**Status:** Implemented  
**Plan:** `docs/superpowers/plans/2026-08-20-hr-strong.md`  
**Branch:** `feat/hr-strong-core`  
**Follow-on:** Marketing Strong (PR 2) — separate spec  
**Source:** Product memo — Marketing/HR “Strong” upgrades; shipping choice **B** (HR first); entitlement **A** (self-service always included on Solo+); desk **A** (three-panel morning view); WhatsApp **A** (copy + `wa.me` sheet); scope **C** (P0 + P1 + P2 in this HR PR)

---

## 1. Problem

Solo+ (`micro` / `sme` / `enterprise`) unlocks the HR pillar, but two gaps keep leave and staffing in Excel/WhatsApp:

1. **Staff self-service is add-on-gated** behind Marketplace `hr-staff-portal`, so multi-staff micro shops cannot use `/hr/me` without an extra purchase.
2. **Owner morning habit is weak** — `/hr` already shows leave/pending/docs fragments, but not a clear “who’s off / who’s due / what’s expiring” desk.
3. **Chat-thread friction** — approve/reject and share-leave exist, but there is no reliable post-decision WhatsApp CTC sheet.
4. **HR file feels thin** — onboarding checklist exists but **% complete** is not a first-class signal on the employee list/header.
5. **Balances and conflicts are incomplete in UI** — AL is clearer than MC; ops booking ↔ leave bridging exists in code but is not always obvious to the owner.

---

## 2. Goals

| Priority | Goal | Success criteria |
|----------|------|------------------|
| **P0** | Staff self-service in core on Solo+ | Linked staff can use `/hr/me` (apply leave, see balances, onboarding) with **no** `hr-staff-portal` purchase |
| **P0** | Owner “today” desk | `/hr` first viewport = three panels: Off today/this week · Pending approvals · Expiring docs |
| **P1** | WhatsApp-ready decisions | After approve/reject: sheet with EN/MS copy + Open WhatsApp when phone exists |
| **P1** | Share leave polish | Create → copy → WhatsApp CTC remains one clear strip (existing token flow) |
| **P1** | Onboarding % | Employee list + header show checklist % complete (same formula as staff portal) |
| **P2** | Clear AL/MC balances | Profile + `/hr/me` + leave form show remaining/used for AL and MC (and EL/Hosp caps when set) |
| **P2** | Leave ↔ booking conflicts | Booking UI shows hard-to-miss conflict; leave approve shows overlapping bookings with warn + confirm |

**North star:** A Solo owner opens `/hr` each morning like POS; staff apply leave in-app; approvals close in WhatsApp without a Business API.

---

## 3. Non-goals (this PR)

- Marketing CRM, follow-up queue, coupon POS clarity, import polish (→ **Marketing Strong** spec / PR 2).
- WhatsApp Business API / automatic send without CTC.
- Payroll, EPF/SOCSO calculation changes, attendance add-on bundling.
- Super-admin i18n; public pay pages.
- New `/hr/today` route (rejected — reshape `/hr` instead).
- Hard-blocking leave approve when bookings conflict (use **warn + confirm**).

---

## 4. Decisions locked

| Topic | Choice |
|-------|--------|
| Shipping | HR PR first (this spec); Marketing PR second |
| Staff portal entitlement | **Always included on Solo+** — remove purchase gate; Marketplace shows **Included** (or hide buy CTA) |
| Owner desk | Three panels as **primary** first viewport on `/hr` |
| Approve/reject WhatsApp | Sheet: Copy EN · Copy MS · Open WhatsApp |
| Scope | P0 + P1 + P2 in this HR PR |
| Implementation approach | Entitlement flip + UI reshape on existing schema (no new domain tables for desk aggregates) |

---

## 5. Entitlement & Marketplace

### 5.1 Runtime

- `hasStaffPortalAddon(businessId)` (or call sites such as `lib/hr/staff-self-service.ts`) must treat staff portal as **available when the business has the HR pillar** (Solo+), regardless of `business_addons` row for `hr-staff-portal`.
- Keep `role === "staff"` + `hr_employees.user_id` link requirements for `/hr/me`.
- Public token leave form `/staff/leave/[token]` remains available without login (unchanged capability).

### 5.2 Marketplace UX

- Catalog entry `hr-staff-portal`: show badge **Included on Solo+**; disable purchase / show “Included” for eligible tiers.
- Existing paid add-on rows: leave as-is (no forced refunds); entitlement still granted via Solo+.
- Owner page `/hr/staff-portal`: **Link staff logins** helper (counts linked vs active), not a paywall (`HrStaffPortalGate` pay CTA removed for Solo+).

### 5.3 Nav

- Staff portal / “My HR” nav items follow the same entitlement (visible when HR unlocked + user is staff or owner managing links).

---

## 6. Owner “today” desk (`/hr`)

### 6.1 First viewport

Three panels, equal weight:

1. **Off today / this week**  
   - Today: approved leave covering today.  
   - This week: approved leave overlapping next 7 calendar days (collapsible or secondary list).  
   - Empty: “Full team in.”

2. **Pending approvals**  
   - Pending leave requests with inline approve/reject (existing `HrLeaveStatusActions` / API).  
   - Empty: “Inbox clear.”

3. **Expiring docs**  
   - Primary: HR documents with `expires_at` within **30 days**, soonest first.  
   - If that list is empty, show up to 5 employees with onboarding completion under 100% as a secondary “Needs file” list in the same panel (not a fourth panel).  
   - Empty (no expiring docs and no incomplete files): “Nothing expiring.”

### 6.2 Below the fold

Retain team roster snippet, holidays upcoming, notification feed, optional add-on panels (appraisals, reminder pack) as secondary — do not compete with the three panels above.

### 6.3 Data

- Prefer extending `loadAdminOverview`-style HR overview loaders already used by `HrOverview` / `app/(app)/hr/page.tsx`.  
- **No new tables** for desk aggregates.

### 6.4 i18n

- Primary chrome strings go through existing next-intl `hr.*` / `messages` catalogs (EN + MS).

---

## 7. Approve / reject WhatsApp sheet

### 7.1 Trigger

After successful `PATCH` leave status → `approved` or `rejected`, open a client sheet (not only a toast).

### 7.2 Content

- Templates in **English** and **Bahasa Melayu**: employee name, leave type, date range, outcome, optional reject reason.  
- Default highlighted language = owner `preferred_locale`; both languages always available.

### 7.3 Actions

- **Copy EN** / **Copy MS**  
- **Open WhatsApp** — `wa.me/<e164>?text=...` when employee phone exists; otherwise disabled with hint to add phone on profile.  
- Dismiss without sending is always allowed.

### 7.4 Security

- No secrets in URLs beyond public leave dates/names the manager already sees.  
- Do not expose sealed identity numbers in WA text.

---

## 8. Share leave polish

- Keep 24h single-use token links (`lib/hr/leave-links.ts`, `/staff/leave/[token]`).  
- Ensure employee leave tab + relevant owner surfaces show one strip: **Create link · Copy · WhatsApp CTC** (existing `HrLeaveLinkActions` pattern).  
- No change to token TTL/security model in this PR unless a bug blocks the strip.

---

## 9. Onboarding checklist % complete

- Formula: shared helper (reuse / extract from `lib/hr/profile-completion.ts` + default onboarding labels in `lib/hr/employee-fields.ts`).  
- Required signals include: identity (IC/passport sealed or checklist), bank, contract, emergency contact, remaining default checklist items.  
- Display:  
  - Employee list row: badge or `NN%`  
  - Employee detail header: same % + link to onboarding section  
  - Staff `/hr/me/onboarding`: unchanged capability, aligned formula  
- Owner can mark checklist items; staff completes what portal already allows.

---

## 10. Balances (AL / MC / caps)

- Surface on: employee profile, `/hr/me`, leave apply form (selected type).  
- **AL:** remaining / entitlement (existing working-day ledger behaviour).  
- **MC:** used toward cap from entitlements JSON (and EL / hospitalisation when caps exist).  
- Do not invent payroll or statutory leave engines.  
- If a type has no entitlement configured, show “Not configured” rather than a fake balance.

---

## 11. Leave ↔ Operations booking conflicts

### 11.1 Existing behaviour to keep

- On leave approve: sync `operations_staff_availability_blocks` (`lib/hr/sync-leave-availability.ts`).  
- Booking create/update: `findStaffLeaveConflicts` when resource has `employee_id`.

### 11.2 UX upgrades

- **Bookings:** conflict message must name the employee and leave dates (owner-obvious; block create/update if current code already blocks — preserve fail-closed behaviour).  
- **Leave approve:** before/after confirm, list overlapping open bookings for that employee; **warn + confirm** to proceed (do not hard-block).  
- **Leave calendar (if present):** badge days with booking conflicts when data available.

---

## 12. Testing

| Area | Tests |
|------|--------|
| Entitlement | Unit: Solo+ → staff portal allowed without addon row; Free/Basic still no HR pillar |
| Overview desk | Unit/loader: today / week leave partitions; pending count; expiring docs window |
| WA templates | Unit: EN/MS strings include name/dates/outcome; no sealed IC |
| Onboarding % | Unit: formula stable for empty / partial / complete |
| Balances | Unit: AL remaining; MC used vs cap |
| Conflicts | Unit: overlapping booking detection for approve warn |

Manual smoke: Solo owner `/hr` morning panels; link staff user → `/hr/me` apply leave; approve → WA sheet; create booking on leave day → conflict visible.

---

## 13. Docs / checklist

- Update `docs/CHECKLIST.md`: staff portal = core on Solo+; HR Strong shipped items.  
- Marketplace copy: Included, not RM29/RM9 purchase for Solo+.  
- Note Marketing Strong deferred to separate spec.

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Existing customers paid for `hr-staff-portal` | Entitlement already free on Solo+; Marketplace “Included”; no silent double-charge |
| Gate UI price mismatch (RM29 vs DB RM9) | Remove paywall for Solo+; fix leftover copy |
| Approve warn ignored | Clear conflict list + confirm checkbox/button label |
| Scope creep into Marketing | Explicit non-goal; PR 2 |

---

## 15. Marketing Strong (out of scope — PR 2 preview)

Deferred (do not implement in this PR):

- One-tap WhatsApp from CRM / segment / draft  
- Follow-up queue (dormant / no purchase / birthday-style)  
- Coupon redemption obvious at POS + customer page  
- Import polish + merge duplicates  
- `last_contacted` + segment “not messaged in 30 days”

---

## 16. Approval

Section approvals in chat:

1. Entitlement & self-service — **yes**  
2. Owner today desk — **yes**  
3. WA sheet + share + onboarding % — **yes**  
4. Balances + conflicts — **yes** (user “eys”)

Awaiting implementation via `docs/superpowers/plans/2026-08-20-hr-strong.md`.
