# Bantu Niaga — Project Checklist

> **Last updated:** 2026-08-06 (cross-pillar sections per module; Marketplace add-on tiers aligned)  
> **Purpose:** Single place to see what is **done**, **pending** (partially shipped or needs deploy/config), and **not done yet** across the system.  
> **Legend:** ✅ Done · 🟡 Pending · ⬜ Not done · — N/A or removed by design

**Module sections (§4–§9):** Each pillar uses the same shape — **Core** (included on plan), **Add-ons** (Marketplace: SCALE · EFFICIENCY · AUTOMATE · AI), and **↔ other modules (cross-pillar)**. Platform, Settings, Integrations, and Super Admin use a single table because they are not product pillars.

---

## Summary

| Area | Done | Pending | Not done |
|------|------|---------|----------|
| Platform & auth | 19 | 3 | 3 |
| Settings & billing | 14 | 3 | 4 |
| Marketplace & AI | 21 | 4 | 8 |
| Admin module | 16 | 2 | 5 |
| Finance module | 16 | 1 | 5 |
| Operations module | 18 | 1 | 5 |
| Sales module | 9 | 1 | 13 |
| Marketing module | 14 | 2 | 9 |
| HR module | 31 | 1 | 7 |
| Integrations & API | 8 | 4 | 4 |
| Super Admin | 6 | 0 | 3 |

---

## Cross-module status (non-addon)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Item | Status | Notes |
|------|--------|-------|
| Admin Storage ↔ all pillars (FK + deep links) | ✅ | Incl. `?txn=` `?supplier=` `?order=` `?product=` |
| Finance ↔ Operations (order → expense) | ✅ | `order.completed` event |
| Operations ↔ Sales (order → lead) | ✅ | `order.created` event |
| Finance ↔ Sales (quote on lead) | ✅ | `sales_lead_id` FK |
| HR ↔ Operations (leave → bookings) | ✅ | `leave.approved` / `leave.rejected` events |
| HR MC → Storage vault | ✅ | Backfill run ✅ (0 legacy rows) |
| Cross-pillar event bus | ✅ | Sync dispatcher + Marketing RPC + cron replay |
| Stock via event bus | ✅ | POS + invoice paid (`product_id` on line items) |
| Marketing `customer.*` / metric events | ✅ | Sync dispatcher (Edge listener optional fallback) |
| Per-business holiday overrides → Ops bookings | ✅ | `business_holiday_overrides` + effective calendar |
| Marketing assets in Admin Storage | ✅ | Social creatives in Marketing Content; signed ads & agreements in vault (`marketing` category) |

**Deploy:** `npx supabase db push` ✅ (2026-08-06).

---

| Status | Item |
|--------|------|
| ✅ | Email/password sign-up and sign-in (Supabase Auth) |
| ✅ | RBAC roles: owner, manager, hr_officer, finance_officer, marketing_officer, operations_officer, sales_rep, staff |
| ✅ | Multi-tenant RLS (`business_id` scoping) |
| ✅ | Middleware route protection for app modules |
| ✅ | Forgot password / reset password flows |
| ✅ | User profile update |
| ✅ | Session list + revoke (security settings) |
| ✅ | 2FA enroll / disable (TOTP) |
| ✅ | PDPA: data export, delete request, consent, privacy sweep cron |
| ✅ | Dual-mode shells (mobile + desktop navigation) |
| ✅ | Home dashboard with pillar snapshots |
| ✅ | `/more` hub and pillar registry |
| ✅ | User sessions migration (`20260707230000`) |
| 🟡 | Team invite email + `/accept-invite` password setup — `NEXT_PUBLIC_APP_URL` ✅ in prod; still needs Supabase Auth SMTP / invite email templates |
| ✅ | Staff login portal (`/hr/me`) — balance, apply leave, history, cancel pending, onboarding view; gated by `hr-staff-portal` add-on + linked `user_id` |
| ✅ | Google social login (sign-in via Supabase OAuth) — existing accounts / invites only |
| 🟡 | Google OAuth production config — enable Google provider in Supabase + Google Cloud OAuth client; redirect `https://<domain>/auth/callback` |
| ✅ | Organisation multi-company switching — sidebar dropdown, `/add-company`, `user_business_memberships` |
| ✅ | Auth rate limiting — sign-up, forgot password, reset password (IP-based) |
| ✅ | Free-first sign-up — default Free path + optional Starter trial |
| ✅ | Onboarding quiz (`/sign-up/guide`) — pre-sign-up only; skippable; can recommend Free |
| ✅ | Post-sign-up recommendation page (`/onboarding/recommendation`) — Phase 1 |
| ✅ | Bundle one-click activate — `POST /api/marketplace/activate-bundle` (tier + add-ons) |

---

## 1b. Onboarding & business bundles

| Status | Item |
|--------|------|
| ✅ | Quiz: business type, team size, priorities (max 2) |
| ✅ | Quiz answers saved on `businesses` (`business_type`, `team_size_band`, `onboarding_priorities`) |
| ✅ | Bundle catalog in code — Pakej Kedai, Kafe, Online, Servis (`lib/onboarding/business-bundles.ts`) |
| ✅ | Recommendation UI — plan step + add-on step, bundle total with 15% add-on discount in copy |
| ✅ | Step-by-step activation — `settings_change_tier` + `marketplace_activate` per add-on |
| ✅ | Skip / manual choice — `onboarding_completed_at`, links to Subscription + Marketplace |
| ✅ | Payroll in bundle — optional checkbox only, never default (Pakej Kafe) |
| ✅ | À la carte pricing unchanged — bundle discount is display-only in Phase 1 |
| ✅ | Hybrid deployment mode — `DEPLOYMENT_MODE=saas|standalone` (Phase 2) |
| ✅ | Standalone bootstrap — one-time sign-up when zero businesses |
| ⬜ | Phase 2: Custom domain + Supabase SMTP + Resend |
| ⬜ | Phase 2: Billplz single checkout for bundle plan + discounted add-ons |
| ✅ | Persist quiz for users who skip guide — default `other` / `solo` / `invoices` saved on sign-up + recommendation backfill |

---

## 2. Settings & billing

| Status | Item |
|--------|------|
| ✅ | Business profile (name, state, branding) |
| ✅ | Subscription tiers: Free, Starter, Growth, Pro, Enterprise |
| ✅ | Plan change UI + proration logic |
| ✅ | Subscription RM0 invoices — Free plan + 14-day trial on sign-up; monthly renewal cron |
| ✅ | Team members list |
| ✅ | Team invite (owner) + roles |
| ✅ | Billing: invoices list with pagination (10/page) |
| ✅ | Credit top-up (dev bypass when Billplz not configured) |
| ✅ | Fast Credits pricing: 100 credits = RM 20 |
| ✅ | Appearance / branding settings |
| ✅ | Security: password, 2FA, sessions, audit log view |
| ✅ | Integrations settings: API keys, webhooks, ILMU/OpenAI keys |
| ✅ | External API ping (`/api/external/v1/ping`) |
| ✅ | External API rate limiting (120 req/min per key) |
| ✅ | API key pepper fail-closed in production (`API_KEY_PEPPER` / `INTEGRATION_ENCRYPTION_KEY`) |
| ✅ | AI Agent activation page (7 agents, daily budget, rename) |
| 🟡 | Billplz live checkout for top-ups — webhook + pending invoice wired; set `BILLPLZ_*` in prod |
| 🟡 | Billplz auto-renew for subscription — renewal cron still issues invoices only (no charge yet) |
| ✅ | Recent migrations applied on remote — `npx supabase db push` (incl. `20260806100000_business_holiday_overrides`) |
| ✅ | Multiple payment methods stored in UI |
| ✅ | Accountant export pack |
| ✅ | Usage-based billing reports |
| ✅ | Invoice PDF email to customer |

---

## 3. Marketplace & AI

| Status | Item |
|--------|------|
| ✅ | Marketplace catalog + activate/deactivate (owner) |
| ✅ | Plan gating: Free cannot activate add-ons |
| ✅ | Module gating: add-on requires unlocked pillar on plan |
| ✅ | Shared credit pool (all AI agents use one balance) |
| ✅ | 100 credits/month bundled per subscribed module AI |
| ✅ | Monthly renewal cron for all module AI assistants |
| ✅ | Credit pause at 0 (no slow mode) |
| ✅ | Per-agent daily budget cap |
| ✅ | Reasoning modes: Fast (`ilmu-mini-v3.3`), Deep (`ilmu-v3.1`) |
| ✅ | **HR AI (Hana)** — staff planner (clarify → plan → act), leave tools, daily notice, credit metering |
| ✅ | **Admin AI (Amir)** — catalog + settings seed |
| ✅ | AI agent display name rename (owner) |
| ✅ | Boardroom page (unlocks with 2+ module agents or boardroom add-on) |
| ✅ | AI context isolation + pillar snapshots |
| ✅ | `ai_usage` metering + audit |
| ✅ | Marketing / Finance / Operations AI — Maya, Fayza, Aiman chat + tenant snapshots |
| ✅ | **Sales AI (Sufi)** — staff planner (clarify → plan → act), lead tools, daily notice |
| ✅ | **Boardroom meeting room** — pick attendees (≥2), clarify/speak/synth, pause/resume/end, history + PDF; create-after-confirm (Maya/Sufi) |
| ✅ | ILMU — super-admin platform key (`/super-admin/integrations/ilmu`); tenant data isolated by `business_id` |
| ✅ | ILMU usage monitor — invocations + spend on `/super-admin/integrations/ilmu` (`ILMU_API_KEY` env OK) |
| ✅ | HR short memory — last 4 turns per user per business (`ai_chat_short_memory`) |
| ✅ | HR assistant — server-side-only chat history (no client `history`); 20 msg/min rate limit |
| ✅ | HR briefing context cache — 120s `unstable_cache` per business |
| ✅ | Vercel crons — `CRON_SECRET` set in production |
| ✅ | Marketing AI chat page |
| ✅ | Finance AI chat page (`/finance/assistant`) |
| ✅ | Operations AI chat page (`/operations/assistant`) |
| ✅ | Sales AI chat page |
| ✅ | Admin AI chat page (`/admin/assistant`) |
| 🟡 | Weekly Boardroom digest email — cron + Resend wired; needs `RESEND_API_KEY` |
| ✅ | Credit rollover policy enforcement UI — top-up vs monthly bundle split; renewal resets bundle; Billing policy card |

### AI module agents (marketplace)

| Agent | Add-on slug | Chat | Daily notice |
|-------|-------------|------|--------------|
| Hana (HR) | `hr-assistant` | ✅ `/hr/assistant` | ✅ |
| Amir (Admin) | `admin-assistant` | ✅ `/admin/assistant` | ✅ |
| Maya (Marketing) | `marketing-assistant` | ✅ `/marketing/assistant` | ✅ |
| Fayza (Finance) | `finance-assistant` | ✅ `/finance/assistant` | ✅ |
| Aiman (Operations) | `operations-assistant` | ✅ `/operations/assistant` | ✅ |
| Sufi (Sales) | `sales-assistant` | ✅ `/sales/assistant` | ✅ |
| Boardroom | `boardroom-weekly` | ✅ `/boardroom` | ✅ cron (Sunday) |

---

## 4. Admin module

> **Unlock:** Starter+ (see entitlements).  
> **Rule:** Core = tasks, compliance, and document storage. Add-ons = AI, automation, and advanced compliance (see pillar docs).

### 4.1 Core Admin (included)

| Status | Item |
|--------|------|
| ✅ | Admin overview (tasks, renewals, storage KPIs) |
| ✅ | Tasks board — columns, drag-and-drop, detail modal, delete |
| ✅ | Tasks ↔ Storage — attach any vault file to a task (`admin_file_id`) |
| ✅ | Compliance tracker — licences, renewals, calendar, export CSV/PDF |
| ✅ | Compliance ↔ Storage — certificate upload links to vault file |
| ✅ | Compliance → Tasks — create prep task after renewal |
| ✅ | Storage vault — upload (bulk), edit metadata, tags, sort, pagination |
| ✅ | Storage — quota bar (tier + `storage-10gb` add-on), preview (PDF/image) |
| ✅ | Storage ↔ HR — HR doc category + staff picker; links to employee records |
| ✅ | Storage “Used by” — compliance licence, HR employee, task links |
| ✅ | In-app compliance reminders (cron; no email in Phase 1) |
| ✅ | `/admin/documents` redirects to Storage (Documents add-on stub hidden) |
| ✅ | RLS + role gates (owner/manager/hr_officer storage scoping) |

### 4.2 Admin add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Extra storage packs | `storage-10gb` | +10 GB vault quota · coming soon |
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Smart compliance alerts | `admin-compliance-alerts` | Proactive renewal nudges · coming soon |
| 🟡 | Smart document vault | `admin-smart-vault` | Auto-sort uploads · coming soon |
| 🟡 | Custom document builder | `admin-doc-builder` | Branded templates · coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Digital signature | `admin-digital-signature` | Sign from secure link · coming soon |
| 🟡 | Approval workflow | `admin-approval-workflow` | Owner/manager approvals · coming soon |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Admin AI (Amir) | `admin-assistant` | RM 20/mo · `/admin/assistant` |

### 4.3 Admin ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **HR** | Staff documents | `hr_employee_documents.admin_file_id` → Storage; upload from HR or Admin Storage (HR doc + staff picker) | ✅ |
| **HR** | Profile completion | Missing IC / bank / contract docs flagged from HR employee records | ✅ |
| **Finance** | Expense receipts | `finance_transactions.admin_file_id` → Storage; attach on `/finance/expenses` | ✅ |
| **Operations** | Supplier contracts | `operations_suppliers.admin_file_id` | ✅ |
| **Operations** | Order documents | `operations_orders.admin_file_id` | ✅ |
| **Operations** | Product spec sheets | `operations_products.spec_file_id` | ✅ |
| **Sales** | Lead proposals | `sales_leads.admin_file_id` | ✅ |
| **HR** | MC documents (vault) | `hr_leave_records.admin_file_id` (new uploads + backfill script) | ✅ |
| **Finance** | Expense deep link | Storage “Used by” → `/finance/expenses?txn={id}` | ✅ |
| **Operations** | Supplier / order / product deep links | Storage “Used by” → `?supplier=` `?order=` `?product=` | ✅ |
| **Marketing** | Content assets | `marketing-media` bucket — photos, reels, carousels on content calendar | ✅ |
| **Marketing** | Back-office marketing docs | Admin Storage vault — category `marketing` (contracts, signed ads, MOUs) | ✅ |
| **Settings** | Plan tier | Storage quota from `businesses.tier` + active `storage-10gb` add-ons | ✅ |
| **Settings** | Team / RBAC | `hr_officer` → Storage HR-docs only; task assignees from `users` | ✅ |
| **Marketplace** | Amir add-on | `admin-assistant` unlocks `/admin/assistant` | ✅ |
| **Home** | Overview | Admin pillar snapshot on dashboard | ✅ |
| **Platform** | Audit log | Admin actions logged (`audit_log`) for Amir context | ✅ |
| **Finance** | Invoice supporting docs | `finance_invoices.admin_file_id` → Storage | ✅ |

---

## 5. Finance module

> **Unlock:** Starter+ (Free tier: invoicing basics).  
> **Rule:** Core = ledger, invoices, quotes, export, DuitNow. **Add-ons wait until core is 100%.**  
> **Gate:** Do not build §5.2 marketplace items until every §5.1 row is ✅ and verified on staging.

### 5.1 Core Finance (included) — finish these first

| Status | Item |
|--------|------|
| ✅ | Finance overview — month picker, MoM compare, expense breakdown, chase list, POS tile |
| ✅ | Expenses — quick log, categories, edit/delete, receipt attach |
| ✅ | Invoices — create, send, draft/sent/paid/void, line items |
| ✅ | Customers — save once, reuse on invoices |
| ✅ | Ledger — full cash flow history (income + expense) |
| ✅ | Quotes — create, list, convert to invoice |
| ✅ | Share + chase — WhatsApp/email link, who owes you on overview |
| ✅ | DuitNow on public invoice (`show_duitnow` toggle) |
| ✅ | Accountant export pack — `/api/finance/export-pack` |
| ✅ | POS tie-in — counter sales on overview + posts to ledger |
| ✅ | Invoice supporting docs — `admin_file_id` on invoices |
| ✅ | Quote → invoice polish — confirm dialog + due date |
| ✅ | Email send fallback — mailto when Resend not configured |
| ✅ | Notification feed — Finance events → `business_notifications` + overview activity panel |
| ✅ | Quote linked to Sales lead | `finance_invoices.sales_lead_id` + create from lead detail |
| ✅ | Order → expense (manual + auto on `done`) | `operations_order_id` on txn; `recordExpenseFromOrder` |

**Core verify before add-ons:** run `supabase db push` (incl. `20260805140000_finance_marketplace_addons.sql`), then `npm run smoke:finance` (expense → invoice → share link → export CSV).

### 5.2 Finance add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | SST advanced reporting | `finance-sst-reporting` | Filing-ready SST summaries · coming soon |
| 🟡 | Cashflow forecast | `finance-cashflow-forecast` | 30–90 day projection · coming soon |
| 🟡 | Full ledger analytics | `finance-ledger-analytics` | Margin by product/customer · coming soon |
| 🟡 | Payment gateway (Billplz) | `finance-payment-gateway` | FPX on public invoice · wired in code · coming soon |
| 🟡 | LHDN e-Invoice connector | `lhdn-einvoice` | MyInvois integration · coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Recurring invoices | `finance-recurring-invoices` | Retainers & monthly billing · coming soon |
| 🟡 | Auto bank reconciliation | `finance-bank-reconciliation` | Match bank CSV to ledger · coming soon |
| 🟡 | Scheduled payment reminders | `finance-payment-reminders` | Auto chase overdue invoices · coming soon |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Finance AI (Fayza) | `finance-assistant` | RM 20/mo · `/finance/assistant` |

### 5.3 Finance ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **Admin** | Expense receipts in Storage | `finance_transactions.admin_file_id`; attach on `/finance/expenses` | ✅ |
| **Admin** | Invoice supporting docs | `finance_invoices.admin_file_id` → Storage vault | ✅ |
| **Admin** | Storage “Used by” deep links | Expense `?txn=` · invoice edit from vault | ✅ |
| **Operations** | Order → expense | `operations_order_id` on txn; manual API + `order.completed` event | ✅ |
| **Sales** | POS → ledger income | `sale.completed` → `postPosSaleToFinance` | ✅ |
| **Sales** | Quote on lead | `finance_invoices.sales_lead_id` + create-quote CTA | ✅ |
| **Sales** | POS void reversal | `sale.voided` soft-deletes linked finance txn | ✅ |
| **Marketing** | Shared customers | `finance_customers` / invoice history on CRM profile | ✅ |
| **Marketing** | Paid invoice → CRM metrics | `invoice.paid` → `marketing_apply_metric_event` RPC | ✅ |
| **Operations** | Invoice paid → stock | `invoice.paid` → `stock.decrement` (line `product_id`) | ✅ |
| **Settings** | Subscription billing | Plan invoices, top-ups, Billplz intents | ✅ |
| **Home** | Overview | Finance pillar snapshot on dashboard | ✅ |
| **Marketplace** | Fayza add-on | `finance-assistant` unlocks `/finance/assistant` | ✅ |
| **Platform** | Billplz webhook | `finance_complete_billplz` + `dispatchInvoicePaid` | ✅ |

---

## 6. Operations module

> **Unlock:** Growth+ (see entitlements).  
> **Rule:** Core = products, services, suppliers, orders, bookings, stock alerts, export. **Add-ons wait until core is 100%.**  
> **Gate:** Do not build §6.2 marketplace items until every §6.1 row is ✅ and verified on staging.

### 6.1 Core Operations (included) — finish these first

| Status | Item |
|--------|------|
| ✅ | Operations overview — vertical profile, KPIs, order pipeline, today’s schedule |
| ✅ | Products catalogue — SKU, price, category, image, stock qty |
| ✅ | Services catalogue — pricing for booking & POS |
| ✅ | Suppliers directory — contacts, payment terms, file attach |
| ✅ | Orders pipeline — todo → in progress → ready → done board |
| ✅ | Order notes, due dates, fulfillment type, supplier link |
| ✅ | Bookings calendar + resources |
| ✅ | Booking buffer + conflict check (create + PATCH) |
| ✅ | Low-stock tracking + overview alerts |
| ✅ | CSV export — `/api/operations/export` |
| ✅ | Storage file attach — orders & suppliers (`admin_file_id`) |
| ✅ | Product spec sheet attach | `operations_products.spec_file_id` → Storage |
| ✅ | Order → Finance expense | Manual button + auto on `done` (`operations_order_id` FK) |
| ✅ | Order → Sales lead | `sales_leads.source_order_id`; auto on create (phone) + manual API |
| ✅ | HR leave → booking blocks | `operations_staff_availability_blocks` on leave approve |
| ✅ | Booking resource ↔ employee | `operations_booking_resources.employee_id` + leave banner |
| ✅ | Notification feed — Operations events → `business_notifications` + overview activity panel |

**Core verify before add-ons:** run `supabase db push` (incl. `20260805150000_operations_marketplace_addons_expand.sql`), then `npm run smoke:operations` (order → done → product → booking → export).

### 6.2 Operations add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Product variants | `product-variants` | Coming soon |
| 🟡 | Multi-location stock | `operations-multi-location-stock` | Coming soon |
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Customer booking page | `customer-booking-page` | Public self-book · coming soon |
| 🟡 | Advanced inventory | `operations-advanced-inventory` | Stock movements · coming soon |
| 🟡 | Resource scheduling | `operations-resource-scheduling` | Staff/rooms on calendar · coming soon |
| 🟡 | Supplier cost analytics | `operations-supplier-analytics` | Coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Auto stock deduction | `auto-stock-deduction` | POS + paid invoices · coming soon |
| 🟡 | Purchase order generator | `operations-purchase-orders` | Coming soon |
| 🟡 | Auto reorder reminders | `operations-auto-reorder` | Coming soon |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Operations AI (Aiman) | `operations-assistant` | RM 20/mo · `/operations/assistant` |

### 6.3 Operations ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **Admin** | Supplier / order file attach | `operations_suppliers.admin_file_id`, `operations_orders.admin_file_id` | ✅ |
| **Admin** | Product spec sheet | `operations_products.spec_file_id` → Storage | ✅ |
| **Admin** | Storage deep links | `?supplier=` `?order=` `?product=` row highlight | ✅ |
| **Finance** | Order → expense | Manual button + `order.completed` event → Finance txn | ✅ |
| **Sales** | Product & service catalog | POS grid APIs read `operations_products` / `operations_services` | ✅ |
| **Sales** | Stock decrement / restore | `stock.decrement` / `stock.restore` from POS + invoice paid | ✅ |
| **Sales** | Order → lead | `sales_leads.source_order_id`; `order.created` event + manual API | ✅ |
| **HR** | Leave → booking blocks | `leave.approved` / `leave.rejected` → availability blocks | ✅ |
| **HR** | Staff on booking resource | `operations_booking_resources.employee_id` + leave conflict check | ✅ |
| **HR** | Leave banner on calendar | `loadActiveLeaveBlocks` on bookings page | ✅ |
| **Home** | Overview | Operations pillar snapshot + low-stock attention | ✅ |
| **Marketplace** | Aiman add-on | `operations-assistant` unlocks `/operations/assistant` | ✅ |
| **Admin AI** | Low stock in Amir context | `lib/ai/context/admin.ts` + notifications | ✅ |

---

## 7. Sales module

> **Unlock:** Growth+ (see entitlements).  
> **Rule:** Core must feel complete for counter + leads. **Add-ons wait until core is 100%.**  
> **Gate:** Do not build §7.2 marketplace items until every §7.1 row is ✅ and verified on staging.

### 7.1 Core Sales (included) — finish these first

| Status | Item |
|--------|------|
| ✅ | Sales overview — POS KPIs + leads pipeline / overdue / due today |
| ✅ | Lead pipeline UI — list, create, status, notes, follow-up |
| ✅ | Lead statuses: new, contacted, interested, won, lost |
| ✅ | Lead notes timeline |
| ✅ | Follow-up reminder on lead (date + due/overdue filters) |
| ✅ | Convert lead → Marketing customer |
| ✅ | Mobile POS page — product grid checkout (Operations catalog) |
| ✅ | Cash payment |
| ✅ | Static DuitNow QR payment (show merchant QR from Branding) |
| ✅ | Basic receipt after sale |
| ✅ | Daily sales summary (real totals) |
| ✅ | POS sale → Finance income / ledger event |
| ✅ | First-visit Sales guide (skip/cancel = done) |
| ✅ | Sales history — period filters + receipt detail |
| ✅ | Sales CSV export (today / week / month) |
| ✅ | Leads Kanban view + drag-to-update status |
| ✅ | Leads bulk status / assignee (multi-select) |
| ✅ | Lead channel analytics on pipeline page |
| ✅ | POS services from Operations catalog |
| ✅ | POS coupon redeem (Marketing) |
| ✅ | POS void sale + stock restore |
| ✅ | Dashboard week compare, top products, cashier summary |
| ✅ | Receipt print view |
| ✅ | Lead / customer → POS deep link (pre-convert name fill) |
| ✅ | Notification feed — Sales events → `business_notifications` + overview activity panel |
| ✅ | Quote on lead | `finance_invoices.sales_lead_id` + create-quote CTA on lead detail |

**Core verify:** `npm run smoke:sales` (lead → POS → receipt → void → export → notifications).

### 7.2 Sales add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Online storefront | `sales-storefront` | Coming soon |
| 🟡 | Hardware POS extensions | `sales-hardware-pos` | Coming soon |
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Sales by staff report | `sales-by-staff` | Coming soon |
| 🟡 | Coupon-to-sales tracking | `sales-coupon-tracking` | Coming soon |
| 🟡 | Daily close-out reconciliation | `sales-daily-closeout` | Coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Dynamic DuitNow QR | `sales-duitnow-dynamic` | Coming soon |
| 🟡 | Refund & void approval | `sales-refund-void` | Coming soon |
| 🟡 | Offline POS mode | `sales-offline-pos` | Coming soon |
| 🟡 | Stale lead alerts | `sales-stale-leads` | Coming soon |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Sales AI (Sufi) | `sales-assistant` | RM 20/mo · `/sales/assistant` |

### 7.3 Sales ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **Admin** | Lead proposal in Storage | `sales_leads.admin_file_id` | ✅ |
| **Finance** | POS → income txn | `sale.completed` event bus | ✅ |
| **Finance** | POS void reversal | `sale.voided` → finance txn soft-delete | ✅ |
| **Finance** | Quote on lead | `finance_invoices.sales_lead_id` + create-quote deep link | ✅ |
| **Operations** | POS product / service grid | Operations catalog APIs | ✅ |
| **Operations** | Stock on sale / void | `sale.completed` / `sale.voided` → `stock.*` events | ✅ |
| **Operations** | Lead from order | `sales_leads.source_order_id` when Ops creates order with phone | ✅ |
| **Marketing** | Lead won → customer | `POST /api/sales/leads/[id]/convert` | ✅ |
| **Marketing** | Coupon at checkout | `coupon_code` on POS checkout | ✅ |
| **Marketing** | Customer → POS link | Pre-fill from Marketing customer detail | ✅ |
| **Home** | Overview | Sales pillar snapshot (POS + pipeline KPIs) | ✅ |
| **Marketplace** | Sufi add-on | `sales-assistant` unlocks `/sales/assistant` | ✅ |

---

## 8. Marketing module

> **Unlock:** Pro (`enterprise` tier).  
> **Rule:** Core must feel complete. **Add-ons wait until core is 100%.**  
> **Gate:** Do not build §8.2 marketplace items until every §8.1 row is ✅ and verified on staging.

### 8.1 Core Marketing (Pro included) — finish these first

| Status | Item |
|--------|------|
| ✅ | Marketing overview + KPIs |
| ✅ | Customers CRM (list, detail, create, merge) |
| ✅ | CSV import / export |
| ✅ | Segments (create, rules, member preview) |
| ✅ | Auto-tags (VIP, dormant, at-risk, repeat, new) |
| ✅ | Dormant / at-risk / VIP one-tap CRM filters |
| ✅ | WhatsApp + Call from customer profile |
| ✅ | Finance invoices on customer Orders tab |
| ✅ | Broadcasts (compose, WhatsApp CTC, email) |
| ✅ | BM / EN broadcast message templates |
| ✅ | Coupons (create, redeem) + WhatsApp / email / copy share |
| ✅ | Public coupon page `/c/[code]` |
| ✅ | Content calendar + media (plan / draft / manual share) |
| ✅ | Customer analytics views (spend, last purchase) |
| ✅ | First-visit Marketing guide (skip/cancel = done) |
| ✅ | Nightly auto-tag refresh cron (`/api/cron/marketing-tag-refresh`) |
| ✅ | POS + invoice line items on customer Orders tab |
| ✅ | Customer activity feed (event outbox on overview) |
| ✅ | Team notification feed — Marketing events → `business_notifications` |

**Core verify:** `npm run smoke:marketing` · full CSV flow: `npm run smoke:m3`.

### 8.2 Marketing add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Audience export packs | `marketing-audience-export` | Coming soon |
| 🟡 | Loyalty & reviews | `loyalty-reviews` | Coming soon |
| 🟡 | CLV report | `clv-report` | Coming soon |
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Meta Social (FB + IG) | `meta-social` | Coming soon |
| 🟡 | Campaign performance analytics | `campaign-analytics` | Coming soon |
| 🟡 | TikTok Shop sync | `tiktok-sync` | Coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | WhatsApp Business API | `whatsapp-business` | Coming soon |
| 🟡 | Email campaign automation | `email-campaign-automation` | Coming soon |
| 🟡 | Dormant reactivation | `dormant-reactivation` | Coming soon |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Marketing AI (Maya) | `marketing-assistant` | RM 20/mo · `/marketing/assistant` |

### 8.3 Marketing ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **Admin** | Storage bridge | Social assets in Marketing Content; back-office marketing docs in vault | ✅ |
| **Sales** | Lead convert → customer | Sales convert flow creates / updates CRM record | ✅ |
| **Sales** | Coupon redeem at POS | Coupon code validated at checkout | ✅ |
| **Sales** | Customer → POS deep link | Marketing customer detail → `/sales/pos` | ✅ |
| **Finance** | Customer invoice history | Finance invoices on customer Orders tab | ✅ |
| **Finance** | POS + invoice line items | Purchase history on customer profile | ✅ |
| **Finance** | Metric events | `invoice.paid` / `order.delivered` / `booking.completed` / `lead.converted` via sync dispatcher | ✅ |
| **Platform** | Customer lifecycle events | `customer.created` / `updated` / `deleted` / `merged` / `tag_changed` ack + cron | ✅ |
| **Home** | Overview | Marketing pillar snapshot + activity feed | ✅ |
| **Marketplace** | Maya add-on | `marketing-assistant` unlocks `/marketing/assistant` | ✅ |

---

## 9. HR module

> **Unlock:** Growth+ (see entitlements).  
> **Rule:** Core = employees, leave, documents, onboarding. **Add-ons wait until core is 100%.**

### 9.1 Core HR (included) — finish these first

| Status | Item |
|--------|------|
| ✅ | HR overview + KPIs |
| ✅ | Employee profiles (create, list, edit, search) |
| ✅ | Employment types, roles, status |
| ✅ | Emergency contact + bank fields |
| ✅ | IC/passport fields |
| ✅ | Profile completion gaps + banners |
| ✅ | Staff documents (upload, link to Admin Storage) |
| ✅ | Document download (signed URL) |
| ✅ | Staff documents folder (`/hr/documents`) |
| ✅ | Leave records (annual, emergency, MC) |
| ✅ | Pending leave approve/reject |
| ✅ | Manager record leave + MC upload |
| ✅ | Share-link leave form (staff, no login) |
| ✅ | Staff self-service portal (`/hr/me`) |
| ✅ | Leave history + AL balance |
| ✅ | Onboarding checklist per employee |
| ✅ | IC/bank encryption at rest |
| ✅ | Audit log on HR mutations |
| ✅ | First-visit HR guide |
| ✅ | Notification feed — HR events → `business_notifications` + overview activity panel |
| ✅ | MC document → Admin Storage vault | `hr_leave_records.admin_file_id` |
| ✅ | Leave → Operations booking blocks | Sync on approve; API rejects staff on leave when resource has `employee_id` |

**Core verify:** `npm run smoke:hr` (employee → leave → approve → notifications).

### 9.2 HR add-ons (Marketplace) — **catalog placeholders · build later**

#### SCALE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | Shift roster | `hr-shift-roster` | Coming soon |
| 🟡 | Time clock | `hr-time-clock` | Coming soon |
| 🟡 | Payroll & statutory pack | `hr-payroll-pack` | Coming soon |
| 🟡 | Extra seats | `extra-seat` | Cross-pillar |

#### EFFICIENCY
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | Public holiday calendar | `hr-public-holidays` | Free · MyCal import |
| ✅ | Staff appraisal checker | `hr-staff-appraisal` | RM 29/mo |
| 🟡 | Advanced leave policy | `hr-advanced-leave-policy` | Coming soon |
| 🟡 | Contract & letter generator | `hr-contract-letters` | Coming soon |

#### AUTOMATE
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| 🟡 | HR reminder pack | `hr-reminder-pack` | Coming soon |
| ✅ | Staff self-service portal | `hr-staff-portal` | `/hr/me` |

#### AI (shipped · not SCALE/EFFICIENCY/AUTOMATE)
| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | HR AI (Hana) | `hr-assistant` | RM 20/mo · `/hr/assistant` |

### 9.3 HR ↔ other modules (cross-pillar)

> Full matrix: [`docs/CROSS-MODULE.md`](./CROSS-MODULE.md)

| Module | Connection | How | Status |
|--------|------------|-----|--------|
| **Admin** | Employee documents in Storage | `hr_employee_documents.admin_file_id` | ✅ |
| **Admin** | MC documents in vault | `hr_leave_records.admin_file_id` (new uploads + backfill script) | ✅ |
| **Admin** | HR doc upload from Storage | HR category + staff picker on vault | ✅ |
| **Operations** | Leave → booking blocks | `leave.approved` / `leave.rejected` events → availability blocks | ✅ |
| **Operations** | Booking conflict on leave | API rejects when resource `employee_id` is on approved leave | ✅ |
| **Operations** | Staff picker on resources | `operations_booking_resources.employee_id` UI | ✅ |
| **Operations** | Leave banner on calendar | `loadActiveLeaveBlocks` | ✅ |
| **Operations** | Holiday / closure → bookings | Effective calendar blocks create + PATCH (`business_closure`) | ✅ |
| **Settings** | Team roles / RBAC | `hr_officer` and pillar roles in `lib/permissions.ts` | ✅ |
| **Home** | Overview | HR pillar snapshot + daily notice | ✅ |
| **Marketplace** | Hana + portal add-ons | `hr-assistant`, `hr-staff-portal`, `hr-public-holidays` | ✅ |
| **Staff portal** | Self-service leave | `/hr/me` — apply leave, balance, MC upload | ✅ |

### 9.4 HR AI (Hana) capabilities

| Status | Capability |
|--------|------------|
| ✅ | Plain-language leave Q&A |
| ✅ | Staff-style clarify → plan → act (like Maya) |
| ✅ | Record leave (annual, MC, emergency) via chat |
| ✅ | Approve/reject pending leave |
| ✅ | Team headcount + staff list from HR data |
| ✅ | Who is on leave today / pending approvals |
| ✅ | Onboarding checklist reminders in snapshot |
| ✅ | Public holidays in briefing (when add-on on) |
| ✅ | Staff appraisal due/overdue in briefing (when add-on on) |
| ✅ | Daily HR notice on Home (toggle) |
| ✅ | Suggested prompt pills |
| ✅ | BM / English |
| ✅ | Shared credit pool + pause at 0 credits |
| ✅ | Dedicated appraisal tools in chat (create/complete via Hana) |

### 9.5 Holiday overrides ↔ Operations (related, not the same)

| Piece | Owner | What it does | Status |
|-------|-------|--------------|--------|
| **Public holiday import** | HR | Federal + state days from MyCal API | ✅ (`hr-public-holidays`) |
| **Per-business holiday overrides** | HR | Add company closure, hide a gazetted day, or move a replacement day (`business_holiday_overrides` table) | ✅ `/hr/holidays` |
| **Effective working calendar** | HR | Imported holidays **merged with** overrides → used for leave day counting | ✅ `lib/hr/effective-calendar.ts` |
| **Operations integration** | Operations | Read the **same effective calendar** to block bookings during public holidays / company closures | ✅ `lib/operations/booking-holidays.ts` |

**Relationship:** Overrides are an **HR data** feature. Operations integration is a **consumer** of that calendar — it does not replace overrides. Build order: (1) overrides in HR → (2) expose effective dates → (3) Operations bookings respect them.

---

## 10. Integrations & external API

| Status | Item |
|--------|------|
| ✅ | ILMU / OpenAI per-business keys (Integrations) |
| ✅ | Outbound webhooks + signing secret |
| ✅ | API keys (create, rotate, revoke) |
| ✅ | Meta Facebook/Instagram OAuth + post |
| ✅ | Billplz / iPay88 catalog entries in integrations |
| 🟡 | Billplz live payment + webhook settlement |
| 🟡 | iPay88 — catalog only |
| 🟡 | Channel integrations (WhatsApp, etc.) — UI “Coming soon” |
| ⬜ | LHDN MyInvois connector |
| ⬜ | Shopee / TikTok sync |
| 🟡 | Cross-pillar event outbox | ✅ Sync dispatcher + Marketing RPC; Edge listener optional fallback |

---

## 11. Super Admin

| Status | Item |
|--------|------|
| ✅ | Super-admin businesses list |
| ✅ | Marketplace add-on status toggle |
| ✅ | Platform integrations config |
| ✅ | Privacy / deletion queue view |
| ✅ | Impersonation (controlled) |
| ✅ | Full revenue dashboard — `/super-admin/revenue` (MRR, collected cash, invoice breakdown) |
| ✅ | Agent model routing per tenant — `/super-admin/businesses/[id]` + `model_override` |
| ✅ | Automated tenant health scoring — `/super-admin/tenant-health` + daily cron |
| ✅ | Super-admin aggregation RPCs — membership, audit, addon, AI usage stats (no full-table scans) |

---

## 12. Deploy & ops checklist

| Status | Action |
|--------|--------|
| ✅ | Run `supabase db push` if remote behind local — 65 local migrations (includes `20260730130000`; verify remote after push) |
| ✅ | `NEXT_PUBLIC_APP_URL` set in production |
| ✅ | `CRON_SECRET` set in Vercel production |
| 🟡 | Set production env: `INTEGRATION_ENCRYPTION_KEY`, `ILMU_API_KEY` (or configure ILMU in super-admin integrations) — `ILMU_API_KEY` ✅ if set in Vercel |
| 🟡 | Configure Supabase Auth email templates / SMTP for team invites — see `docs/DEPLOY-SMTP.md` |
| 🟡 | Google social login — Supabase Auth → Providers → Google; add OAuth client + `/auth/callback` redirect |
| ✅ | Vercel crons configured: `privacy-sweep`, `hr-daily-notice`, `marketing-daily-notice`, `sales-daily-notice`, `finance-daily-notice`, `operations-daily-notice`, `admin-daily-notice`, `hr-assistant-renewal`, `subscription-renewal`, `tenant-health`, `events-dispatch` |
| ⬜ | Billplz production keys + webhook URL |
| ⬜ | E2E test suite in CI |
| ⬜ | Staging environment parity |

### Migrations added recently (verify on remote)

| Migration | Purpose |
|-----------|---------|
| `20260707270000_expand_team_roles.sql` | marketing_officer, operations_officer, sales_rep |
| `20260707280000_admin_ai_agent.sql` | Admin AI (Amir) marketplace + seed |
| `20260707290000_reasoning_mode_models.sql` | Fast/Deep models, remove `auto` |
| `20260707300000_shared_ai_credits_renewal.sql` | Monthly credits for all module AIs |
| `20260707310000_hr_staff_appraisal_addon.sql` | Staff Appraisal Checker add-on + table |
| `20260708000000_user_business_memberships.sql` | Multi-company switching + sidebar dropdown |
| `20260708100000_super_admin_insights.sql` | Model override, health snapshots, AI usage rollup |
| `20260708110000_ai_chat_short_memory.sql` | Per-business short AI chat memory (4 turns) |
| `20260708120000_perf_security_indexes.sql` | Paid-invoice index + super-admin aggregation RPCs |
| `20260708140000_onboarding_fields.sql` | Quiz answers + `onboarding_completed_at` on businesses |
| `20260711090000_marketing_addons_coming_soon.sql` | Marketing add-ons coming soon + Meta/email/loyalty seeds |
| `20260730130000_hr_staff_self_service_rls.sql` | Staff `/hr/me` RLS — self read employee, insert leave, read balances + onboarding |
| `20260730200000_credit_rollover_policy.sql` | Top-up vs bundle credit split; monthly grant reset; bundle-first spend |
| `20260730280000_cross_pillar_admin_file_links.sql` | Finance, Ops, Sales ↔ Admin Storage |
| `20260731010000_finance_billplz_and_invoice_attachments.sql` | Invoice `admin_file_id` |
| `20260805180000_cross_module_bridges.sql` | Spec sheets, order expense FK, lead quote FK, MC vault, leave blocks |
| `20260805190000_cross_module_polish.sql` | `sales_leads.source_order_id`, resource employee index |
| `20260805220000_extend_cross_pillar_event_index.sql` | Index incl. invoice.paid + customer.* |
| `20260806100000_business_holiday_overrides.sql` | Per-business holiday overrides + effective calendar |

---

## 13. Phase 2+ backlog (not started)

> **Build order (see [team-direction.md](./team-direction.md) §3.5):** finish / settle **core modules** first. Paid add-ons wait until cores are stable. Placeholders in Marketplace stay “coming soon”.

### Do next (core / platform settle)

- **Finance core:** ✅ feature-complete — verify on staging (`db push` + smoke test); **no new Finance add-ons**
- **Operations core:** ✅ cross-module bridges shipped — verify on staging (`db push` incl. `20260805180000` + `20260805190000`)
- **Sales core:** verify quote-on-lead + POS flows on staging
- Auth: Supabase SMTP / Resend for invites + (later) email verification; Google OAuth provider in Supabase for social sign-in
- Module AI polish only after that module’s core is verified

### After cores settle (add-ons — do not start early)

- Finance: Billplz live keys, LHDN, recurring invoices, SST reports, bank reconciliation
- **Cross-pillar event bus / outbox** — ✅ sync dispatcher shipped; Marketing `customer.*` remains async Edge listener
- **Onboarding Phase 2** — one-click bundle activate + discounted billing
- Paid HR add-ons: advanced leave, payroll, roster, time clock, contracts
- Digital signature, approval workflows, advanced compliance

---

## How to update this file

1. When a feature ships, move it from ⬜ or 🟡 to ✅ and add a line to `docs/CHANGELOG.md`.
2. When something is half-built (UI without API, or API without migration), mark 🟡 with a short note.
3. Keep §12 in sync after each release so deploy steps are not missed.
