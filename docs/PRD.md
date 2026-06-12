# Product Requirements Document — BantuNiaga

> **Status:** v0.3 — Draft for engineering kickoff
> **Owner:** Founder (Asyraf)
> **Last updated:** 2026-06-02
> **Related docs:** [README](./README.md) · [Pillars](./pillars/) · [Architecture](./architecture/) · [AI](./ai/) · [v1 core scope](./v1-core-scope.md) · [Plans](./plans/)

---

## 1. Product Overview

### 1.1 Product Name
**Bantu Niaga** (internal codename: **SME-OS**).

### 1.2 Product Type
**Dual-mode SaaS system:**

- 🖥️ **Desktop ERP** — Control & Analytics layer
- 📱 **Mobile PWA** — Execution layer

Both modes share one PostgreSQL backbone, one auth + RBAC layer, one event bus, one billing system. Full architectural detail: [architecture/dual-mode.md](./architecture/dual-mode.md).

### 1.3 Vision
To become the **operating system for Malaysian micro-SMEs** by replacing fragmented tools (WhatsApp threads, Excel files, paper logbooks, manual bookkeeping) with a unified, modular, AI-powered business platform.

### 1.4 Core Concept
Bantu Niaga is built as:

- A **modular ERP** organized into 6 business pillars
- An **add-on marketplace** for à-la-carte feature expansion
- An **AI decision intelligence layer** (per-pillar Agents + the Executive Boardroom)
- A **mobile-first execution system** (PWA)
- A **desktop-heavy control system** (Web ERP)

### 1.5 Product Positioning

**Bantu Niaga IS:**
> A **Dual-Mode AI Business Operating System** for Malaysian Micro-SMEs.

**Bantu Niaga is NOT:**
- Accounting software (Xero, QuickBooks, Bukku)
- A traditional ERP (Odoo, SAP)
- A standalone CRM (HubSpot, Pipedrive)
- A POS-only app (StoreHub, Loyverse)

The categorical refusal matters: anchoring against any single category undersells what the product is, and overpromises within that single category.

---

## 2. Document Purpose

This PRD is the **definitive engineering specification** for v1 of Bantu Niaga. It defines:

- What we are building (scope), and what we are explicitly **not** building (out of scope).
- Who it is for, and how success will be measured.
- The functional and non-functional requirements every team must meet.

Pillar feature lists, data models, and detailed user flows live in the pillar docs and are referenced here — not duplicated. **If a pillar doc disagrees with this PRD, the pillar doc wins for feature-level detail and this PRD wins for scope, prioritization, and acceptance criteria.**

---

## 3. Target Market

### 3.1 Primary Users
- Micro SMEs (1–20 staff)
- Sole proprietors
- Enterprise-status SSM-registered businesses
- Home-based businesses
- Retail shops
- F&B stalls and kafes
- Service-based businesses (salons, homestays, tuition centers)

### 3.2 User Behavior Assumptions
- Business operations run primarily from a **mobile phone**.
- **WhatsApp is the primary communication tool** — with customers, suppliers, staff.
- **Low technical literacy** — software UX must be self-explanatory.
- **Speed beats complexity** — owners abandon any flow that takes too many taps.
- **Automation beats manual entry** — every saved keystroke is retention.

### 3.3 Personas

**Persona A — "Kak Yana the Home-Baker"**
- Tier: Starter (RM50) · 1 person · WA-driven orders.
- Mode: 100% mobile PWA.
- Job: replace paper notebook + WA threads.

**Persona B — "Encik Hafiz the Kedai Owner"**
- Tier: Micro (RM80) + Inventory Automation · 2 part-time helpers.
- Mode: ~80% mobile (counter), ~20% desktop (Sunday review).
- Job: stop running out of best-sellers; track helper hours.

**Persona C — "Cik Aida the Salon Operator"**
- Tier: SME (RM120) + Booking + Self-Service Leave + HR AI · 8 staff.
- Mode: ~60% mobile (daily), ~40% desktop (Monday admin).
- Job: scale staff without scaling her own hours.

**Persona D — "Tuan Ridzuan the Online Seller"**
- Tier: SME (RM120) + UTM + Promo + LHDN + Marketing AI + Sales AI → Boardroom.
- Mode: ~50/50 — desktop for analytics + Boardroom, mobile for shipping.
- Job: graduate from "owner with TikTok" to "compliant business".

---

## 4. Product Architecture

```
BANTU NIAGA SYSTEM
│
├── 🖥️ DESKTOP ERP LAYER (CONTROL CENTER)
│   ├── Finance Dashboard           (P&L, Balance Sheet, Reconciliations)
│   ├── HR Management System        (Roster, Payroll, Statutory)
│   ├── Operations Control Panel    (Calendar, Supplier reports, Catalog editor)
│   ├── Sales CRM Dashboard         (Pipeline analytics, Funnel)
│   ├── Marketing Analytics Hub     (Cohorts, UTM, ROI)
│   ├── Compliance Center           (LHDN, EPF/SOCSO/EIS, audit log)
│   └── AI Boardroom Console        (Primary surface for multi-Agent runs)
│
├── 📱 MOBILE PWA LAYER (EXECUTION ENGINE)
│   ├── Quick POS Sales             (< 5s ring-up)
│   ├── Invoice Sharing             (WhatsApp-first)
│   ├── Expense Capture             (Camera-first)
│   ├── Task Quick Board            (Swipe TODO → DOING → DONE)
│   ├── AI Morning Brief            (3-item daily per Agent)
│   ├── Stock Quick Update          (One-tap +/-)
│   ├── Booking Quick Confirm       (Swipe accept/decline)
│   └── Leave Approve / Reject      (Notification swipe)
│
├── 🧩 BUSINESS PILLARS              (Same canonical features in both modes)
│   ├── Admin · Finance · Operations
│   └── Marketing · Sales · HR
│
├── 🤖 AI SYSTEM LAYER
│   ├── Pillar AI Agents            (6 — one per pillar)
│   ├── Executive Boardroom AI      (Multi-agent orchestrator)
│   └── Credit & Token Engine       (Pool · Slow Mode · Top-ups)
│
└── ⚙️ INFRASTRUCTURE LAYER
    ├── Next.js (Web ERP + Mobile PWA, single codebase)
    ├── Next.js Route Handlers + Supabase Edge Functions
    ├── Supabase Postgres (multi-tenant, RLS) + Auth + Storage + Realtime
    └── Billplz / Curlec payments
```

Detail: [architecture/dual-mode.md](./architecture/dual-mode.md) · [architecture/tech-stack.md](./architecture/tech-stack.md) · [architecture/cross-pillar-sync.md](./architecture/cross-pillar-sync.md).

---

## 5. Core Product Principles

1. **Execution first.** Mobile users complete actions in **< 10 seconds**; hot paths (POS sale, mark-paid, task tick) in **< 5 seconds**.
2. **Control second.** Desktop is for deep management, analytics, reporting, and configuration — never for the dozens-per-day actions.
3. **Modular system.** Users activate and pay only for the pillars and add-ons they need.
4. **AI-augmented decisions.** AI supports — it does not replace — the business owner's judgment. Structured triggers, no open chat boxes.
5. **WhatsApp is a first-class output channel.** Every shareable artifact has a one-tap "Share via WhatsApp" CTA.
6. **Secure-by-default sharing.** Every public URL is `bantuniaga.com/[idcompany]/[prefix]-[secure-random-hash]`.
7. **Malaysia-native.** LHDN, DuitNow, IC, AL/EL/MC, BM-friendly copy.
8. **Throttle, don't block.** Resource exhaustion (credits, storage) downgrades quality of service, never disables operational workflows.

---

## 6. User Roles (RBAC) — 6 Roles in v1

The full 6-role model ships in v1. Reason: a salon with 8 staff or a kedai with 5 staff genuinely needs the granularity — keeping the cashier out of payroll and the HR officer out of the bank reconciliation isn't a "nice to have," it's a **product requirement** for the Micro and SME tiers.

| Role | Access | Primary Mode | Tier where it matters |
|------|--------|--------------|------|
| **Owner** | Full system access (incl. billing + role assignment) | Both | All tiers |
| **Manager** | Operational control across active pillars; no billing / role assignment | Both | Micro, SME |
| **Accountant** | Finance module only (read/write) | Desktop | All tiers |
| **HR Officer** | HR module only + Admin storage for HR docs | Both | Micro, SME |
| **Cashier** | POS surface only | Mobile | SME (Sales pillar) |
| **Staff** | Assigned task board + Self-Service Leave only | Mobile | Micro, SME |

Role × Mode matrix and per-pillar permissions: [architecture/dual-mode.md §5](./architecture/dual-mode.md).

### Implementation Strategy — One Permissions Matrix, Not 720 Decisions

The earlier "720 permission decisions" warning was misleading. In practice the rule set is small because most roles have access to a **single pillar**:

| Role | Pillar Access |
|------|---------------|
| Owner | Admin, Finance, Operations, Marketing, Sales, HR, Billing, Team Mgmt |
| Manager | Admin, Finance, Operations, Marketing, Sales, HR (no Billing/Team Mgmt) |
| Accountant | Finance only |
| HR Officer | HR + Admin (storage for HR docs) |
| Cashier | Sales (POS surface only) |
| Staff | Admin (assigned tasks) + HR (Self-Service Leave) |

That's **~30 role × pillar rules**, not 720. The pattern:

1. A **single permissions matrix** (TypeScript constant + a `permissions` table mirror in Postgres) is the source of truth.
2. A **`can(user, action, resource)`** helper function reads the matrix and returns `boolean`.
3. **Supabase RLS policies** call the matrix at the DB layer.
4. **Next.js middleware** calls the matrix at the API layer.
5. **`<RequirePermission>` React component** calls the matrix at the UI layer.

All three layers (DB / API / UI) read from **one matrix file**. Add a new feature → add one row to the matrix → all three layers update.

**Build investment:** ~2–3 weeks of focused Phase 0 work to set up the matrix + helpers + RLS pattern. After that, every pillar feature you ship is one matrix row + one RLS policy. The complexity is amortized across all features.

### Acceptance Criteria

- A **single permissions matrix** file (e.g. `lib/permissions.ts`) defines every rule.
- Every protected query is gated by a Postgres RLS policy that reads `auth.uid()`, `role`, `business_id` from the Supabase JWT and looks up the matrix.
- Every Next.js Route Handler calls `can()` before issuing the query (fast-fail + clean errors).
- UI shell uses `<RequirePermission>` to hide surfaces a role can't access.
- Owner can invite by email/phone, assign one of 6 roles, and revoke access from a single Settings → Team screen.
- Role changes take effect within 60 seconds (session refresh via Supabase Realtime).
- Every role change writes to the `audit_log`.
- Unit tests cover every **role × pillar** access combination (~30 tests, not 720).
- A "negative test" suite proves every role gets `403` on every forbidden pillar.

---

## 7. Goals & Non-Goals

### 7.1 v1 Goals

| # | Goal | Measurable Target |
|---|------|-------------------|
| G1 | A Starter user can run a full week of business on the phone with no other tool. | ≥ 80% of Starter accounts log ≥ 5 transactions/week in month 2 |
| G2 | Invoice → payment → ledger entry → stock decrement loop works end-to-end. | < 5s from "Mark Paid" tap to all downstream effects committed |
| G3 | Mobile execution actions complete in under 10 seconds. | p95 of mobile hot-path events ≤ 10s end-to-end |
| G4 | An owner can send an LHDN-compliant invoice XML by month 1 of subscribing. | ≥ 60% of SME-tier users with LHDN add-on generate ≥ 1 XML/month |
| G5 | At least 30% of paying users subscribe to ≥ 1 AI Agent within 90 days. | Cohort analysis |
| G6 | Boardroom users perform ≥ 4 multi-agent runs/month on average. | Engagement metric |
| G7 | Slow Mode preserves operational continuity. | 0 support tickets citing "AI blocked my work" |
| G8 | Role-based access prevents Cashier/Staff from seeing financial data. | 0 incidents of unauthorized data exposure |

### 7.2 Non-Goals for v1

- **Sdn Bhd / corporate double-entry accounting.** We serve Enterprise-status sole props.
- **Multi-currency.** MYR only.
- **Native iOS/Android apps.** v1 is dual-mode web (Desktop ERP + Mobile PWA).
- **Open-ended AI chat.** All AI is structured-trigger only.
- **Auto-posting to social platforms.** The Marketing Content Calendar is planning-only.
- **WhatsApp Business API (sending/receiving messages programmatically).**
- **Multi-business consolidation.** One `idcompany` per subscription.
- **Statutory payroll deductions (EPF/SOCSO/EIS/PCB)** as a default feature. Available as an HR add-on.
- **Offline-first base operation.** Only the Hardware & POS add-on includes an offline cache.

---

## 8. User Stories (v1 Scope)

Prioritized **MoSCoW** — see [v1-core-scope.md](./v1-core-scope.md) and the pillar docs for full detail. Each story carries a US-ID for traceability.

### 8.1 Admin
| ID | Story | Priority |
|----|-------|---------|
| US-A1 | Upload a receipt photo and tag it (mobile camera-first; desktop drag-drop). | M |
| US-A2 | Manage daily tasks on TODO → DOING → DONE kanban (mobile swipe; desktop drag). | M |
| US-A3 | Generate a Quotation by filling fields in a locked template, in < 60s. | M |
| US-A4 | Fully customize a template (Custom Document Builder add-on, **desktop only**). | S |
| US-A5 | Expand storage to 5 GB or 20 GB if needed. | M |

### 8.2 Finance
| ID | Story | Priority |
|----|-------|---------|
| US-F1 | Log a revenue or expense entry in under 5s (mobile primary). | M |
| US-F2 | Generate a secure invoice URL and share via WhatsApp (mobile primary). | M |
| US-F3 | Marking an invoice "Paid" auto-creates the ledger entry (cross-pillar). | M |
| US-F4 | Export LHDN-compliant XML (LHDN add-on, **desktop only**). | M |
| US-F5 | See real P&L and Balance Sheet (Analytics add-on, **desktop only**). | S |

### 8.3 Operations
| ID | Story | Priority |
|----|-------|---------|
| US-O1 | Move an order through New → In Progress → Ready → Delivered. | M |
| US-O2 | Add a supplier with payment terms and material cost log (desktop primary). | M |
| US-O3 | Build a product catalog (mobile basics, desktop variants/groups/images). | M |
| US-O4 | Take bookings against multiple resources on a calendar. | M |
| US-O5 | Paid invoice decrements stock; alert when below safety line (Stock Tracker add-on). | M |

### 8.4 Marketing
| ID | Story | Priority |
|----|-------|---------|
| US-M1 | Phone-deduped customer record showing total spend + last visit. | M |
| US-M2 | Plan TikTok / IG / FB posts on a calendar. | M |
| US-M3 | UTM-tracked link with per-source click counts (UTM add-on). | S |
| US-M4 | Generate a WhatsApp script with baked-in discount (Promo Engine add-on). | S |

### 8.5 Sales (SME tier only)
| ID | Story | Priority |
|----|-------|---------|
| US-S1 | Track leads through New → Contacted → Negotiating → Won/Lost. | M |
| US-S2 | Ring up a sale in under 5s via product grid + Cash or DuitNow QR (static or dynamic-per-amount). | M |
| US-S3 | Alert when premium leads stay uncontacted > 48h (Stale Deal add-on). | S |
| US-S4 | Pair a Bluetooth thermal printer + scan barcodes (Hardware add-on). | C |

### 8.6 HR
| ID | Story | Priority |
|----|-------|---------|
| US-H1 | Store employee data (IC, emergency, bank) securely (desktop primary). | M |
| US-H2 | Record leave (AL/EL/MC) + see who's out on a calendar. | M |
| US-H3 | Staff submits leave from mobile PWA using their Staff role login. | M |
| US-H4 | Approving leave fires an automated email + in-app notification to staff. | M |
| US-H5 | Drag staff onto a weekly shift grid (Rota add-on, **desktop primary**). | S |

### 8.7 AI
| ID | Story | Priority |
|----|-------|---------|
| US-AI1 | See a 3-item morning brief per subscribed Agent. | M |
| US-AI2 | One-tap draft of a structured action (e.g. follow-up text). | M |
| US-AI3 | Open the Executive Boardroom and ask a multi-pillar question (≥ 2 Agents subscribed, **desktop primary**). | M |
| US-AI4 | Queries continue in Slow Mode when credits run out — never blocked. | M |
| US-AI5 | Top up credits (RM10 → 50 Fast Credits) and return to Fast Mode immediately. | M |

### 8.8 Onboarding & Platform Basics (Phase 1 must-haves, added in v0.4)
| ID | Story | Priority |
|----|-------|---------|
| US-ON1 | As a new signup, I complete a 5-step onboarding wizard (business info → first product → first customer → first invoice → "you're ready"). | M |
| US-ON2 | As a Malay-speaking owner, I can switch the entire UI to **Bahasa Melayu** from settings. | M |
| US-ON3 | As any user, I can tap "Get Help" anywhere → opens WhatsApp to the founder's support number with context prefilled. | M |
| US-ON4 | As a new user, when I generate my first invoice, I see a celebration screen + a one-tap testimonial submit. | S |

---

## 9. Functional Requirements

### 9.1 Tier Gating

| Tier | Price (RM/mo) | Active Pillars | Staff Seats |
|------|--------------:|----------------|------------:|
| Starter | 50 | Admin · Finance · Operations | 1 (owner only) |
| Micro | 80 | + Marketing + HR | 3 |
| SME | 120 | + Sales (all 6) | 10 |

**Acceptance criteria:**
- Locked pillars do not appear in navigation (mobile or desktop).
- API endpoints for locked pillars return `403 PILLAR_LOCKED` with an upgrade CTA payload.
- Buffered events targeting locked pillars are stored and resurfaced on upgrade.
- Seat overage prevents new staff invites until either staff are deactivated or seats are added.

### 9.2 Cross-Pillar Sync

Full event map: [architecture/cross-pillar-sync.md](./architecture/cross-pillar-sync.md).

**Acceptance criteria for v1:**
- `invoice.paid` triggers Finance ledger + Operations stock decrement + Marketing customer-stats update + Admin notification — all in one DB transaction.
- `payroll.approved` triggers Finance expense entry tagged `Staff Remuneration`.
- `leave.approved` / `leave.rejected` triggers an automated email + in-app notification to the staff role user.
- `lead.captured` from a Marketing surface lands in Sales Prospect CRM (or buffers if Sales locked).
- All async handlers idempotent; retried with exponential backoff (max 5).

### 9.3 AI Layer

Full spec: [ai/agents.md](./ai/agents.md), [ai/executive-boardroom.md](./ai/executive-boardroom.md).

**Acceptance criteria for v1:**
- Each subscribed Agent emits a daily 3-item briefing on the dashboard (mobile + desktop).
- Credit deduction logged to `ai_usage`; balance derivable from the sum.
- When balance hits 0, requests route to Slow Mode (15–20s deterministic delay), never fail.
- Top-up purchase (RM10 / 50 credits) returns the business to Fast Mode within 1s.
- Boardroom activates when ≥ 2 Agents are subscribed; relevance filter silences non-applicable Agents at zero credit cost.
- Every AI output validates against a strict JSON Schema.

### 9.4 Secure URL System

`bantuniaga.com/[idcompany]/[prefix]-[hash]` — full spec in [glossary.md](./glossary.md).

### 9.5 Role-Based Access Control

**Acceptance criteria:**
- Every protected endpoint declares a `requiredRole` and the API middleware enforces it.
- UI shell renders only the surfaces a role can access.
- Role-permission rules are unit-tested for every combination of role × pillar × action.

### 9.6 Dual-Mode Behavior

**Acceptance criteria:**
- The same business account works seamlessly across mobile PWA and desktop ERP — same session, same data.
- Surfaces marked **mobile-only** (POS) or **desktop-only** (Boardroom Console, LHDN Export, Template Editor, deep dashboards) follow the matrix in [dual-mode.md §4](./architecture/dual-mode.md).
- When a mobile user tries to reach a desktop-only feature, they get a clear "open this on desktop" handoff (not a 404).

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target |
|--------|-------:|
| Mobile PWA FCP (mid-Android, 4G) | < 2s |
| Desktop FCP | < 1.5s |
| Hot-path actions (POS sale, task tick, invoice send) | **< 5s end-to-end** |
| General mobile execution | **< 10s end-to-end** |
| API p95 latency | < 300ms |
| AI Fast Mode response | < 2s |
| AI Slow Mode response | 15–20s deterministic |
| Boardroom run (4 Agents) | < 8s Fast Mode |

### 10.2 Reliability

| Metric | Target |
|--------|-------:|
| **Uptime SLO** | **99.9%** |
| RPO | ≤ 24h |
| RTO | ≤ 4h |
| Event handler retries | 5, exponential backoff |

### 10.3 Security
- TLS everywhere; HSTS on production.
- Postgres RLS for tenant isolation.
- Sensitive fields (IC, bank) encrypted at rest with per-tenant data keys (envelope encryption via KMS).
- Object storage: server-side encryption + signed short-lived download URLs.
- All public URLs use cryptographically random hashes.
- OWASP Top 10 baseline mitigations.
- Audit log on every mutation.
- **RBAC enforced at API + UI + DB-policy layers (defense in depth).**

### 10.4 Compliance
- LHDN e-Invoicing XML schema (current active phase).
- PDPA (Malaysia) — clear data export + delete-on-request flows.
- LHDN audit trail retention ≥ 7 years.

### 10.5 Accessibility
- Touch targets ≥ 44 × 44 px.
- WCAG 2.1 AA color contrast.
- Labels on every form field.
- BM + English support at minimum.

---

## 11. Technical Requirements — Stack LOCKED

Full detail: [tech-stack.md](./architecture/tech-stack.md).

| Layer | Choice |
|-------|--------|
| Hosting + frontend | **Vercel (Singapore edge)** |
| Frontend | Next.js (Web ERP + PWA) + Tailwind CSS |
| Backend | **Next.js Route Handlers + Supabase Edge Functions** (no separate Express service) |
| Database + Auth + Storage + Realtime | **Supabase (Singapore)** — Postgres with RLS, Auth, S3-compatible Storage, Realtime |
| AI | OpenAI GPT-4o-mini, strict JSON Schema |
| Payments | Billplz (primary) / Curlec (fallback) |
| Email | Supabase Auth emails + Resend for app emails |

**No more blocking architecture decisions for sprint 1.** Previously open items (Postgres provider, object storage, auth provider, deployment platform, job queue) are all resolved by the Vercel + Supabase choice.

---

## 12. Infrastructure Cost Model — Vercel + Supabase

Engineered for **micro-SME-friendly margins from day one** with the Vercel + Supabase choice.

### 12.1 Stage-Based Fixed Cost

| Stage | Paying users | Vercel | Supabase | Other | Total RM/mo |
|-------|------:|--------|----------|-------|------:|
| **MVP** | 0–100 | Hobby (Free) | Free | ~RM 10 | **~RM 10** |
| **Growth** | 100–1,000 | Pro (~RM 90) | Pro (~RM 115) | ~RM 15 | **~RM 220** |
| **Scale** | 1,000–10,000 | Pro (~RM 90) | Team (~RM 600) | ~RM 30 | **~RM 720** |

**MVP fixed cost is now ~RM 10/month, not RM 80.** Free tiers carry the first 100 paying customers.

### 12.2 Variable AI Cost
**~RM 0.26 per active user / month** (unchanged):

- Daily summary calls (1 credit/Agent/day × 30 days × ~RM 0.001/credit) ≈ RM 0.03 per subscribed Agent.
- User-triggered text generations + aggregations ≈ RM 0.10–0.15.
- Boardroom usage (4-credit runs, ~4/month) ≈ RM 0.08.

### 12.3 Margin at Each Stage

| Stage | Users | Total cost (RM) | MRR @ blended RM 80 | Gross margin |
|-------|------:|------:|-----:|----:|
| MVP | 50 | ~23 | 4,000 | **~99.4%** |
| Growth | 500 | ~350 | 40,000 | **~99.1%** |
| Scale | 5,000 | ~2,000 | 400,000 | **~99.5%** |

**Break-even on infrastructure: 1 paying customer at MVP stage.**

### 12.4 Acceptance Criteria
- Per-business marginal infra cost is **derivable from logs and < RM 5/month at p95**.
- AI usage metering writes to `ai_usage` for every call.
- A monthly cost report breaks down: Vercel / Supabase / OpenAI / Resend / per business.

---

## 13. UX Requirements

The pillar docs contain detailed user flows. Platform-wide:

### Mobile (Execution Layer)
- Fast actions, minimal typing, camera-first inputs.
- WhatsApp-first share CTAs.
- Bottom-navigation in TikTok / Shopee style (5 tabs max, thumb-reachable).
- Quick Actions tile (3 chosen per role) on the home screen.
- Credit cost visible on every AI-triggering button.

### Desktop (Control Layer)
- Data-density dashboards (4-pane grids, persistent left sidebar, contextual right panel).
- Reporting tools, multi-chart analytics, side-by-side comparisons.
- AI Boardroom Console as a horizontal scroll lane with synthesis block.

Full pattern reference: [architecture/dual-mode.md §8–9](./architecture/dual-mode.md).

---

## 14. Success Metrics

### 14.1 Year-1 Targets

| Metric | Target |
|--------|-------:|
| Total users (incl. free trial) | **1,000** |
| Paying customers | **300** |
| MRR | **RM 30K–RM 100K** |
| Churn rate | **< 5%/month** |
| Uptime | **99.9%** |
| Activation: % completing first transaction in 7 days | ≥ 60% |
| Retention: M6 retention of paying users | ≥ 60% |
| Add-on attach: % of paying users with ≥ 1 add-on at day 90 | ≥ 35% |
| AI adoption: % of paying users with ≥ 1 AI Agent at day 90 | ≥ 30% |
| AI engagement: Boardroom runs/month per eligible user | ≥ 4 |
| Margin: Blended gross margin | ≥ 95% (per infra cost model) |
| Support: Tickets per 100 active accounts/month | ≤ 5 |

---

## 15. MVP Roadmap — Slimmed for Earlier Customer Validation

The optimized roadmap ships **paying customers at Week 10 instead of Week 24** by cutting non-essential scope from Phase 1.

### Phase 0 — Foundations (Weeks 1–4)
The RBAC foundation is built **once** and amortized across all later features.
- Vercel + Supabase project setup.
- Supabase Auth (email/pass + magic link for staff invites + optional OTP for Owner).
- Multi-tenancy: `business_id` on every table + RLS policies.
- **Full permissions matrix** (`lib/permissions.ts` + mirrored `permissions` table).
- `can(user, action, resource)` helper + `<RequirePermission>` component + middleware wrapper.
- All 6 roles defined and tested at the schema layer (even if some surfaces don't exist yet).
- Audit log table + write helpers.
- Billplz integration (Starter plan only at first).

### Phase 1 — Starter MVP (Weeks 5–12) — **FIRST 10 PAYING CUSTOMERS**
- **Tier:** Starter only (RM 50).
- **Pillars:** Admin · Finance · Operations.
- **Roles wired up so far:** Owner + Accountant (Accountant gets Finance-pillar access).
- **Mode:** Responsive web (no Service Worker / PWA polish yet).
- **Cross-pillar sync:** one event — `invoice.paid → ledger entry`.
- **Onboarding wizard:** 5-step guided setup.
- **BM language support** from day 1.
- **In-app WhatsApp support button** to founder's number.
- No AI · No add-ons · No Boardroom.

### Phase 2 — Micro Expansion (Weeks 13–20)
- + Marketing + HR pillars (= Micro tier RM 80).
- **Roles wired up:** + Manager + HR Officer + Staff.
- + PWA polish (Service Worker, install prompt, Web Push notifications).
- + Top 3 add-ons by validated demand (e.g. Micro Stock Tracker, Storage 5 GB, Self-Service Leave).
- + Cross-pillar sync: `payroll.approved`, `leave.approved`.

### Phase 3 — Sales + POS + LHDN (Weeks 21–28)
- + Sales pillar (Lead CRM + Mobile POS) = SME tier (RM 120).
- **Roles wired up:** + Cashier (all 6 roles fully active now).
- + LHDN E-Invoicing Exporter add-on (with LHDN advisor on retainer).
- + Sales-related add-ons (Hardware POS, Stale Deal Alarms).
- + Cross-pillar sync: full event map.

### Phase 4 — AI Agents (Weeks 29–36)
- 3 AI Agents first: **Finance · Operations · Sales** (the most validated demand).
- Proactive Morning Dashboard.
- Credit pool + Slow Mode + Top-ups.
- AI usage metering via `ai_usage`.

### Phase 5 — Boardroom + Remaining AI (Weeks 37–44)
- Remaining 3 AI Agents: Admin · Marketing · HR.
- Executive Boardroom orchestrator + Relevance Safeguard Filter.
- Boardroom Console (desktop primary).
- Saved Boardroom history + WhatsApp share.

### Why this is better than the original 36-week plan
| Outcome | Original (36 wk) | Optimized (44 wk total, but 12 wk to first revenue) |
|---------|------------------|------|
| First paying customer | Week 24 | **Week 12** |
| Learning loop with real users | Late | **From Week 12** |
| RBAC built once vs. distributed | distributed across phases | **One Phase 0 investment** |
| RBAC tests | ~3,000 action-level | **~30 role × pillar × negative tests** |
| Stack decisions remaining | 7 open | **0 open** |
| Infra cost at MVP | ~RM 80/mo | **~RM 10/mo** |

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|-------:|------------|
| LHDN schema changes mid-build | High | Version export path; advisor on retainer; live-maintain. |
| OpenAI outage / pricing change | Medium | Strict JSON Schema + token caps keep cost predictable. Failover post-v1. |
| Slow Mode too lenient → margin erosion | Medium | Cap concurrent Slow Mode queue depth; monitor abuse signatures. |
| Slow Mode too punitive → churn | Medium | Usability study during closed beta; adjust window if needed. |
| Dual-mode complexity slows engineering | Medium | Single Next.js codebase; component variants per mode; one shared API. |
| RBAC bugs leak sensitive data across roles | High | Defense-in-depth: API middleware + UI guard + DB row-level checks; per-combo unit tests. |
| Mobile push (Web Push) reliability on iOS | Low–Medium | Fallback to in-app + email notifications; iOS 16.4+ supports Web Push. |
| Boardroom prompt injection | High | All AI inputs/outputs JSON-Schema-bound; no system prompt leakage paths. |

---

## 17. Explicit Out of Scope (v1 / Phase 1 Starter MVP)

**Out of scope forever for v1:**
- Sdn Bhd corporate accounting.
- Multi-currency.
- Native iOS / Android apps.
- Open-ended AI chat surfaces.
- Auto-posting to social platforms.
- WhatsApp Business API send/receive.
- Multi-business consolidation.
- Statutory deductions as base feature (available as add-on in Phase 3+).
- Offline-first base operation.

**Deferred to later phases:**
- Marketing pillar → Phase 2.
- HR pillar → Phase 2.
- Sales pillar + Mobile POS → Phase 3.
- LHDN E-Invoicing Exporter → Phase 3.
- Custom Document Builder (drag-drop editor) → Phase 3+.
- Hardware & Advanced POS Extensions → Phase 3+.
- Multi-resource bookings (Operations) → Phase 3+.
- All 6 AI Agents → Phase 4 (3 most-demanded first).
- Executive Boardroom → Phase 5.

**Built in Phase 0 / Phase 1 (not deferred):**
- Full 6-role RBAC permission matrix + RLS policies (schema-level all roles; UI surfaces them as their pillars come online).

---

## 18. Open Questions

> Items resolved by the v1 core/add-on review on 2026-06-12 (SST handling, per-business invoice numbering, pipeline column customizability, product variants, refunds/voids in POS, public-holiday calendar, customer dedup rule, CSV import, dynamic DuitNow QR, buffer time between bookings, AL carry-forward) have moved to [v1-core-scope.md](./v1-core-scope.md) §"Resolved Open Questions".

### Product / Pricing
- [ ] Exact per-Agent pricing within RM15–20.
- [ ] Free trial duration per tier.
- [ ] Annual prepay discount.
- [ ] Multi-business discount.
- [ ] Staff seat overage pricing.
- [ ] Top-up bundle ladder beyond RM10/50.
- [ ] Reconciling the abbreviated 5-add-on summary in the latest founder PRD with the canonical detailed catalog in [marketplace-addons.md](./marketplace-addons.md) — which add-on names ship to customers?

### Pillar / Feature
- [ ] Final v1 list of bundled document templates.
- [ ] Storage downgrade retention policy.
- [ ] UTM redirect: self-host vs platform analytics.
- [ ] Encryption scheme details for IC + bank.

### Architecture (most resolved)
- [x] ~~ORM choice~~ — Supabase JS client at v1; add Drizzle if needed.
- [x] ~~Job queue choice~~ — Supabase Edge Functions + Postgres triggers + Realtime.
- [x] ~~Managed Postgres provider~~ — **Supabase**.
- [x] ~~Object storage provider~~ — **Supabase Storage**.
- [x] ~~Auth provider~~ — **Supabase Auth**.
- [x] ~~Deployment platform~~ — **Vercel**.
- [ ] Observability stack: Vercel + Supabase logs + Sentry at v1; expand to Better Stack / Datadog at Scale.
- [ ] AI failover model — single-vendor (OpenAI) at v1; revisit at Scale.
- [ ] Web Push fallback for iOS < 16.4 — in-app + email at v1.

### AI / Boardroom
- [ ] Pinned Agents override the relevance filter?
- [ ] Boardroom output language follows user input language?
- [ ] Daily summary pausable per pillar?
- [ ] Transparency: show user the prompt sent on their behalf?

### Roles / Dual-Mode
- [ ] Can Manager invite Staff/Cashier, or only Owner?
- [ ] Can a single user hold two roles (e.g. Manager + HR Officer)?
- [ ] Should mobile/desktop session state sync across devices?
- [ ] Tablet-optimized layout — yes or treat as small desktop?

---

## 19. Acceptance Criteria Framework

Every PR closing a US-* story must:
1. Reference the US-ID in commit / PR title.
2. Include an automated test verifying the success condition.
3. Update the relevant pillar / architecture doc's "Open Questions" section if any were resolved.
4. Pass RBAC unit tests for every role × pillar combination it touches.

---

## 20. Sign-Off

| Role | Name | Sign-off |
|------|------|----------|
| Product / Founder | Asyraf | _Pending_ |
| Engineering Lead | _TBD_ | _Pending_ |
| Design Lead | _TBD_ | _Pending_ |
| LHDN / Tax Advisor | _TBD_ | _Pending_ |

---

## 21. Change Log

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| v0.1 | 2026-06-02 | AI scaffold | Initial feature capture from founder spec. |
| v0.2 | 2026-06-02 | AI scaffold | Added SME-OS project proposal: tiers, sync, AI layer, infrastructure. |
| v0.3 | 2026-06-02 | AI scaffold | Absorbed dual-mode (Desktop ERP + Mobile PWA), 6-role RBAC, infrastructure cost model, NOT positioning, updated success metrics, 5-phase MVP roadmap. |
| v0.4 | 2026-06-02 | AI scaffold | **Optimized for speed:** locked stack (Vercel + Supabase), simplified RBAC v1 (2 roles instead of 6), slimmed roadmap (first paying customer at Week 10 instead of Week 24), deferred non-essential features to later phases. |
| v0.5 | 2026-06-02 | AI scaffold | **RBAC restored to full 6 roles in v1** (product requirement for Micro + SME tiers). Built once in Phase 0 via permissions matrix + RLS, then UI surfaced as pillars come online. First paying customer now Week 12. |
| v0.6 | 2026-06-12 | Docs audit | Architecture diagram updated (removed `Node.js + Express API`; reflects locked Next.js Route Handlers + Supabase Edge Functions stack). Dynamic DuitNow QR removed from Non-Goals / Out-of-Scope — now in v1 core per [v1-core-scope.md](./v1-core-scope.md). Open Questions trimmed; items resolved by the core/add-on review on 2026-06-12 now live in v1-core-scope.md. |
