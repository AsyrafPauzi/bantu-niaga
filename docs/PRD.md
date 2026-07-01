# Product Requirements Document — BantuNiaga

> **Status:** v0.7 — Product packaging cleanup
> **Owner:** Founder (Asyraf)
> **Last updated:** 2026-06-21
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

Bantu Niaga focuses on three customer groups:

- **Solo entrepreneurs** — one-person businesses, freelancers, home sellers, small service providers, and owner-operators who need speed and less mental load.
- **Micro SMEs** — small teams that need structure for customers, invoices, tasks, documents, products, orders, and basic staff records.
- **Growing SMEs** — businesses with more staff, sales activity, compliance pressure, and a need for controls, roles, approvals, reports, and add-ons.

Common segments include home-based businesses, retail shops, F&B stalls and cafes, online sellers, salons, homestays, tuition centres, service businesses, and SSM-registered owner-led businesses.

Detailed target-market examples and plan recommendations live in [target-market.md](./target-market.md). Pricing details, add-on price bands, trials, and discount guidance live in [pricing-plan.md](./pricing-plan.md).

### 3.2 Plan Fit by Target

**Free** is for solo entrepreneurs who need invoice and payment discipline first: income tracking, invoices, receipt upload for records, and payment tracking. Free does not include expense tracking, saved customers, or add-on purchases.

**Starter** is for micro SMEs that need operating structure: Finance, Admin, and Operations for expenses, saved customers, documents, tasks, products, suppliers, orders, bookings, and basic stock.

**Growth** is for businesses with staff and sales activity: Sales and HR unlock lead tracking, mobile POS, staff records, and leave tracking.

**Pro** is for growing SMEs that need customer retention: Marketing unlocks CRM, segments, content calendar, coupons, media, and broadcast drafts.

### 3.3 User Behavior Assumptions
- Business operations run primarily from a **mobile phone**.
- **WhatsApp is the primary communication tool** — with customers, suppliers, staff.
- **Low technical literacy** — software UX must be self-explanatory.
- **Speed beats complexity** — owners abandon any flow that takes too many taps.
- **Automation feels premium** — but should usually live in add-ons unless needed to complete the core workflow.

### 3.4 Personas

**Persona A — "Kak Yana the Home-Baker"**
- Segment: Solo entrepreneur · 1 person · WhatsApp-driven orders.
- Mode: 100% mobile PWA.
- Job: replace paper notebook + WA threads.

**Persona B — "Encik Hafiz the Kedai Owner"**
- Segment: Micro SME · 2 part-time helpers.
- Mode: ~80% mobile (counter), ~20% desktop (Sunday review).
- Job: organize products, documents, simple stock, invoices, and helper work.

**Persona C — "Cik Aida the Salon Operator"**
- Segment: Growing SME · 8 staff.
- Mode: ~60% mobile (daily), ~40% desktop (Monday admin).
- Job: manage bookings, staff records, leave, repeat customers, and service operations.

**Persona D — "Tuan Ridzuan the Online Seller"**
- Segment: Growing SME · online seller with campaign and compliance needs.
- Mode: ~50/50 — desktop for analytics + Boardroom, mobile for shipping.
- Job: graduate from "owner with TikTok" to structured, compliant, repeatable business.

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

The full 6-role model ships in v1. Reason: a salon with 8 staff or a kedai with 5 staff genuinely needs the granularity — keeping the cashier out of payroll and the HR officer out of finance controls is not a "nice to have", it is a product requirement for growing SMEs.

| Role | Access | Primary Mode | Tier where it matters |
|------|--------|--------------|------|
| **Owner** | Full system access (incl. billing + role assignment) | Both | All tiers |
| **Manager** | Operational control across active modules; no billing / role assignment | Both | Starter, Growth, Pro |
| **Accountant** | Finance module only (read/write) | Desktop | All tiers |
| **HR Officer** | HR module only + Admin storage for HR docs | Both | Growth, Pro |
| **Cashier** | POS surface only | Mobile | Growth, Pro |
| **Staff** | Assigned task board + HR self-service surfaces when enabled | Mobile | Starter, Growth, Pro |

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
| G1 | A solo entrepreneur can run a full week of invoice and payment tracking on the phone with no other tool. | ≥ 80% of active Free accounts log ≥ 5 invoice/payment actions/week in month 2 |
| G2 | Invoice → payment tracking → ledger summary works end-to-end. | < 5s from "Mark Paid" tap to finance state update |
| G3 | Mobile execution actions complete in under 10 seconds. | p95 of mobile hot-path events ≤ 10s end-to-end |
| G4 | A growing SME can activate at least one useful add-on without confusing the core workflow. | ≥ 25% of paying customers activate ≥ 1 add-on within 90 days |
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

## 8. User Stories (Core Scope)

Prioritized **MoSCoW** — see [v1-core-scope.md](./v1-core-scope.md) and the module docs for full detail. Add-on stories live in [marketplace-addons.md](./marketplace-addons.md). Each story carries a US-ID for traceability.

### 8.1 Admin
| ID | Story | Priority |
|----|-------|---------|
| US-A1 | Upload a receipt photo and tag it (mobile camera-first; desktop drag-drop). | M |
| US-A2 | Manage daily tasks on TODO → DOING → DONE kanban (mobile swipe; desktop drag). | M |
| US-A3 | Add a compliance reminder for SSM, licence, tenancy, insurance, or permit dates. | M |
| US-A4 | Generate a basic document from a fill-in template. | S |

### 8.2 Finance
| ID | Story | Priority |
|----|-------|---------|
| US-F1 | Log a revenue or expense entry in under 5s (mobile primary). | M |
| US-F2 | Generate a secure invoice URL and share via WhatsApp (mobile primary). | M |
| US-F3 | Marking an invoice "Paid" auto-creates the ledger entry (cross-pillar). | M |
| US-F4 | Show DuitNow payment information and invoice reference on the invoice page. | M |
| US-F5 | Produce a WhatsApp-ready overdue payment reminder text. | S |

### 8.3 Operations
| ID | Story | Priority |
|----|-------|---------|
| US-O1 | Move an order through New → In Progress → Ready → Delivered. | M |
| US-O2 | Add a supplier with contact details and payment terms. | M |
| US-O3 | Build a product or service catalog with SKU, category, price, and image. | M |
| US-O4 | Add a booking or appointment on a calendar. | M |
| US-O5 | Record basic stock quantity and show a low-stock warning. | S |

### 8.4 Marketing
| ID | Story | Priority |
|----|-------|---------|
| US-M1 | Create and update customer records with tags and notes. | M |
| US-M2 | Plan TikTok / IG / FB posts on a calendar. | M |
| US-M3 | Import or export a customer list. | S |
| US-M4 | Create a basic coupon and track redemption. | S |

### 8.5 Sales
| ID | Story | Priority |
|----|-------|---------|
| US-S1 | Track leads through New → Contacted → Interested → Won/Lost. | M |
| US-S2 | Convert a won lead into a customer. | M |
| US-S3 | Ring up a simple sale through mobile POS with cash or static DuitNow QR. | M |
| US-S4 | Show a basic receipt and daily sales summary. | S |

### 8.6 HR
| ID | Story | Priority |
|----|-------|---------|
| US-H1 | Store employee data (IC, emergency, bank) securely (desktop primary). | M |
| US-H2 | Record AL, EL, and MC leave and approve or reject it. | M |
| US-H3 | View public holidays as a reference calendar. | S |
| US-H4 | Track onboarding checklist items for new staff. | S |

### 8.7 AI
| ID | Story | Priority |
|----|-------|---------|
| US-AI1 | Subscribe to an optional AI agent for an unlocked module. | S |
| US-AI2 | Use one-tap structured AI actions such as reminder drafts or summaries. | S |
| US-AI3 | Open the Executive Boardroom when two or more AI agents are active. | C |
| US-AI4 | Top up credits and return to Fast Mode. | C |

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

| Tier | Price (RM/mo) | Active Modules | Staff Seats |
|------|--------------:|----------------|------------:|
| Free | 0 | Finance Lite: income, invoices, receipt upload, payment tracking. No expenses, saved customers, or add-ons. | 1 owner |
| Starter | 69 | Finance · Admin · Operations | 3 staff seats |
| Growth | 139 | Finance · Admin · Operations · Sales · HR | 5 staff seats |
| Pro | 249 | All six modules, including Marketing | Unlimited |

**Acceptance criteria:**
- Locked modules do not appear in navigation (mobile or desktop), or appear only as upgrade prompts where product wants upsell education.
- Free businesses cannot activate Marketplace add-ons.
- Paid businesses can activate add-ons only for modules unlocked by their current plan.
- API endpoints for locked modules return `403 PILLAR_LOCKED` or the current equivalent entitlement error with an upgrade CTA payload.
- Buffered events targeting locked modules are stored and resurfaced on upgrade where the receiving module needs historical context.
- Seat overage prevents new staff invites until either staff are deactivated or seats are added.

### 9.2 Cross-Pillar Sync

Full event map: [architecture/cross-pillar-sync.md](./architecture/cross-pillar-sync.md).

**Acceptance criteria for core:**
- `invoice.paid` updates Finance ledger state and can notify Admin.
- POS sales can update Finance summaries and Marketing customer history when those modules are active.
- Operations stock decrement only runs when the relevant inventory add-on is active.
- HR leave decisions update HR leave state; automated employee messaging is an add-on.
- Marketing leads or campaigns can connect to Sales when Sales is active; otherwise the event is buffered or ignored according to entitlement rules.
- All async handlers are idempotent and tenant-scoped.

### 9.3 AI Layer

Full spec: [ai/agents.md](./ai/agents.md), [ai/executive-boardroom.md](./ai/executive-boardroom.md).

**Acceptance criteria for AI add-ons:**
- Each subscribed Agent uses structured triggers rather than open-ended module chat.
- Credit deduction is logged to `ai_usage`; balance is derivable from the ledger.
- When balance hits 0, requests route to Slow Mode rather than breaking the workflow.
- Top-up purchase restores Fast Mode.
- Boardroom activates when two or more Agents are subscribed.
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

| Stage | Users | Total cost (RM) | MRR @ blended RM 100 | Gross margin |
|-------|------:|------:|-----:|----:|
| MVP | 50 | ~23 | 5,000 | **~99.5%** |
| Growth | 500 | ~350 | 50,000 | **~99.3%** |
| Scale | 5,000 | ~2,000 | 500,000 | **~99.6%** |

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

## 15. Product Roadmap

The roadmap should validate the simple core loops first, then add premium capabilities where customers show real demand.

### Phase 0 — Foundations (Weeks 1–4)
The RBAC foundation is built **once** and amortized across all later features.
- Vercel + Supabase project setup.
- Supabase Auth (email/pass + magic link for staff invites + optional OTP for Owner).
- Multi-tenancy: `business_id` on every table + RLS policies.
- **Full permissions matrix** (`lib/permissions.ts` + mirrored `permissions` table).
- `can(user, action, resource)` helper + `<RequirePermission>` component + middleware wrapper.
- All 6 roles defined and tested at the schema layer (even if some surfaces don't exist yet).
- Audit log table + write helpers.
- Billing foundation for Free, Starter, Growth, and Pro.

### Phase 1 — Free Finance Lite Loop (Weeks 5–12)
- **Tier:** Free.
- **Module:** Finance.
- **Goal:** solo entrepreneurs can record income, invoices, payment status, and receipt uploads. Expenses, saved customers, and add-ons require Starter or higher.
- **Roles wired up so far:** Owner + Accountant.
- **Mode:** Responsive web with mobile-first finance actions.
- **Sync:** invoice paid updates finance ledger state.
- **Onboarding wizard:** 5-step guided setup.
- **BM language support** from day 1.
- **In-app WhatsApp support button** to founder's number.
- No AI · No add-ons · No Boardroom.

### Phase 2 — Starter Operating Core (Weeks 13–20)
- **Tier:** Starter.
- **Modules:** Finance · Admin · Operations.
- **Goal:** small teams can manage documents, tasks, products, suppliers, orders, bookings, and basic stock alongside finance.
- **Roles wired up:** Manager + Staff where relevant.
- + PWA polish where it improves daily actions.
- + First add-ons by validated demand, likely Extra Storage Pack and Operations inventory expansion.
- **Sync:** Sales is not required yet; Operations and Finance can link through invoices and customer records where available.

### Phase 3 — Growth Team and Sales Core (Weeks 21–28)
- **Tier:** Growth.
- **Modules:** Finance · Admin · Operations · Sales · HR.
- **Goal:** businesses with staff and counter activity can track leads, take simple POS sales, record staff data, and manage leave.
- **Roles wired up:** Cashier + HR Officer.
- + Sales-related add-ons by demand: Dynamic DuitNow QR, refund/void approval, close-out reconciliation, hardware POS.
- + HR add-ons by demand: Self-Service Leave Forms, Shift Roster, HR Reminder Pack.

### Phase 4 — Pro Marketing and Premium Add-ons (Weeks 29–36)
- **Tier:** Pro.
- **Modules:** all six, including Marketing.
- **Goal:** established SMEs can bring customers back through CRM, segments, content, coupons, and campaign workflows.
- + Marketing add-ons by demand: WhatsApp Business API, campaign analytics, smart segments, dormant customer reactivation.
- + Finance compliance add-ons: LHDN E-Invoice Connector, SST Advanced Reporting, Accountant Export Pack.

### Phase 5 — AI Agents and Boardroom (Weeks 37–44)
- Per-module AI Agents, starting with the highest-demand modules.
- Credit pool + Slow Mode + Top-ups.
- AI usage metering via `ai_usage`.
- Executive Boardroom when two or more AI agents are active.
- Boardroom Console and weekly digest.

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

## 17. Explicit Out of Scope for Core

**Out of scope forever for v1:**
- Sdn Bhd corporate accounting.
- Multi-currency.
- Native iOS / Android apps.
- Open-ended AI chat surfaces.
- Auto-posting to social platforms.
- WhatsApp Business API send/receive.
- Multi-business consolidation.
- Statutory deductions as a base feature.
- Offline-first base operation.

**Deferred to later phases:**
- Marketing module → Pro tier.
- HR module → Growth tier.
- Sales module + Mobile POS → Growth tier.
- LHDN E-Invoice Connector → Finance add-on.
- Custom Document Builder → Admin add-on.
- Hardware POS Extensions → Sales add-on.
- Multi-resource booking and resource scheduling → Operations add-on.
- All AI agents → add-on layer.
- Executive Boardroom → AI add-on layer.

**Built early, not deferred:**
- Full 6-role RBAC permission matrix + RLS policies (schema-level all roles; UI surfaces them as their modules come online).

---

## 18. Open Questions

The current core/add-on split is defined in [v1-core-scope.md](./v1-core-scope.md) and [marketplace-addons.md](./marketplace-addons.md). Older decisions that placed premium features into core should not override the current packaging rule.

### Product / Pricing
- [ ] Exact per-Agent pricing within RM15–20.
- [ ] Free trial duration per tier.
- [ ] Annual prepay discount.
- [ ] Multi-business discount.
- [ ] Staff seat overage pricing.
- [ ] Top-up bundle ladder beyond RM10/50.
- [ ] Which planned add-ons should be seeded into the live Marketplace first.
- [ ] Final customer-facing names and prices for each add-on.

### Pillar / Feature
- [ ] Final v1 list of bundled document templates.
- [ ] Storage downgrade retention policy.
- [ ] Encryption scheme details for IC + bank.
- [ ] Which low-stock behavior belongs in core warning vs Operations inventory add-on.
- [ ] Which public booking behaviors ship first when the Operations booking add-on is built.

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
| v0.5 | 2026-06-02 | AI scaffold | **RBAC restored to full 6 roles in v1** using the earlier Micro/SME tier wording. Built once in Phase 0 via permissions matrix + RLS, then surfaced as modules come online. |
| v0.6 | 2026-06-12 | Docs audit | Architecture diagram updated (removed `Node.js + Express API`; reflects locked Next.js Route Handlers + Supabase Edge Functions stack). Earlier core/add-on decisions were captured for reference and later superseded by the v0.7 packaging cleanup. |
| v0.7 | 2026-06-21 | Product packaging cleanup | Reframed target market as solo entrepreneurs, micro SMEs, and growing SMEs. Re-split module scope so core covers daily workflows and add-ons carry automation, analytics, integrations, approvals, AI, and scale. |
