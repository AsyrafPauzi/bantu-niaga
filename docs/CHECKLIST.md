# Bantu Niaga — Project Checklist

> **Last updated:** 2026-07-08 (onboarding Phase 1)  
> **Purpose:** Single place to see what is **done**, **pending** (partially shipped or needs deploy/config), and **not done yet** across the system.  
> **Legend:** ✅ Done · 🟡 Pending · ⬜ Not done

---

## Summary

| Area | Done | Pending | Not done |
|------|------|---------|----------|
| Platform & auth | 16 | 2 | 3 |
| Settings & billing | 14 | 3 | 4 |
| Marketplace & AI | 21 | 4 | 8 |
| Admin module | 8 | 1 | 6 |
| Finance module | 11 | 2 | 8 |
| Operations module | 9 | 1 | 7 |
| Sales module | 5 | 1 | 6 |
| Marketing module | 14 | 2 | 8 |
| HR module | 22 | 2 | 10 |
| Integrations & API | 8 | 3 | 5 |
| Super Admin | 6 | 0 | 3 |

---

## 1. Platform & authentication

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
| ⬜ | Staff login portal (`/hr/me`) |
| ⬜ | SSO / social login |
| ✅ | Organisation multi-company switching — sidebar dropdown, `/add-company`, `user_business_memberships` |
| ✅ | Auth rate limiting — sign-up, forgot password, reset password (IP-based) |
| ✅ | Free-first sign-up — default Free path + optional Starter trial |
| ✅ | Onboarding quiz (`/sign-up/guide`) — pre-sign-up only; skippable; can recommend Free |
| ✅ | Post-sign-up recommendation page (`/onboarding/recommendation`) — Phase 1 |
| 🟡 | Business bundle one-click activate — Phase 2 (`/api/marketplace/activate-bundle` returns 501) |

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
| ⬜ | Phase 2: `marketplace_bundles` table + single “Activate Café Pack” RPC |
| ⬜ | Phase 2: Billplz single checkout for bundle plan + discounted add-ons |
| ⬜ | Persist quiz for users who skip guide (default generic recommendation) |

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
| 🟡 | Billplz live checkout for top-ups — TODO in code; dev bypass only |
| 🟡 | Billplz auto-renew for subscription — not fully wired |
| 🟡 | Recent migrations may need `supabase db push` on remote — see §12 migrations table |
| ⬜ | Multiple payment methods stored in UI |
| ⬜ | Accountant export pack |
| ⬜ | Usage-based billing reports |
| ⬜ | Invoice PDF email to customer |

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
| ✅ | **HR AI (Hana)** — chat, leave tools, daily notice, credit metering |
| ✅ | **Admin AI (Amir)** — catalog + settings seed |
| ✅ | AI agent display name rename (owner) |
| ✅ | Boardroom page (unlocks with 2+ module agents or boardroom add-on) |
| ✅ | AI context isolation + pillar snapshots |
| ✅ | `ai_usage` metering + audit |
| 🟡 | Marketing / Finance / Operations / Sales AI — marketplace listing only, **no chat UI yet** (`chatHref: null`) |
| 🟡 | Boardroom multi-agent synthesis — UI exists; depth varies by active agents |
| ✅ | ILMU — super-admin platform key (`/super-admin/integrations/ilmu`); tenant data isolated by `business_id` |
| ✅ | ILMU usage monitor — invocations + spend on `/super-admin/integrations/ilmu` (`ILMU_API_KEY` env OK) |
| ✅ | HR short memory — last 4 turns per user per business (`ai_chat_short_memory`) |
| ✅ | HR assistant — server-side-only chat history (no client `history`); 20 msg/min rate limit |
| ✅ | HR briefing context cache — 120s `unstable_cache` per business |
| ✅ | Vercel crons — `CRON_SECRET` set in production |
| ⬜ | Marketing AI chat page |
| ⬜ | Finance AI chat page |
| ⬜ | Operations AI chat page |
| ⬜ | Sales AI chat page |
| ⬜ | Admin AI chat page |
| ⬜ | Weekly Boardroom digest email |
| ⬜ | Auto reasoning mode (removed by design) |
| ⬜ | Credit rollover policy enforcement UI |

### AI module agents (marketplace)

| Agent | Add-on slug | Chat | Daily notice |
|-------|-------------|------|--------------|
| Hana (HR) | `hr-assistant` | ✅ `/hr/assistant` | ✅ |
| Amir (Admin) | `admin-assistant` | ⬜ | ⬜ |
| Maya (Marketing) | `marketing-assistant` | ⬜ | ⬜ |
| Fayza (Finance) | `finance-assistant` | ⬜ | ⬜ |
| Aiman (Operations) | `operations-assistant` | ⬜ | ⬜ |
| Sufi (Sales) | `sales-assistant` | ⬜ | ⬜ |
| Boardroom | `boardroom-weekly` | ✅ `/boardroom` | ⬜ |

---

## 4. Admin module

| Status | Item |
|--------|------|
| ✅ | Admin overview |
| ✅ | Tasks board (create, update, status) |
| ✅ | Compliance calendar (reminders) |
| ✅ | Document storage (upload, list, download) |
| ✅ | Storage folders / file metadata |
| ✅ | Secure share links for files |
| ✅ | RLS for admin roles |
| ✅ | Admin AI add-on in marketplace (Amir) |
| 🟡 | Smart compliance alerts add-on — coming soon |
| ⬜ | Digital signature add-on |
| ⬜ | Custom document builder |
| ⬜ | Approval workflow add-on |
| ⬜ | Admin audit export report |
| ⬜ | Auto document categorization |
| ⬜ | Extra storage packs |

---

## 5. Finance module

| Status | Item |
|--------|------|
| ✅ | Finance overview |
| ✅ | Income / expense transactions |
| ✅ | Ledger view |
| ✅ | Invoices v2 (create, edit, list, statuses) |
| ✅ | Invoice public link (customer view) |
| ✅ | Finance customers (shared with marketing) |
| ✅ | Basic finance APIs + RLS |
| ✅ | Finance server pages use RLS client (not service role) |
| ✅ | Finance AI add-on in marketplace (placeholder) |
| 🟡 | DuitNow panel on invoices — verify copy/fields per tenant |
| 🟡 | Quote-to-invoice — check if fully wired in UI |
| ⬜ | LHDN e-Invoice connector add-on |
| ⬜ | SST advanced reporting |
| ⬜ | Cashflow forecast |
| ⬜ | Recurring invoices |
| ⬜ | Payment gateway webhooks (Billplz live) |
| ⬜ | Auto bank reconciliation |
| ⬜ | Accountant export pack |
| ⬜ | Finance AI chat |

---

## 6. Operations module

| Status | Item |
|--------|------|
| ✅ | Operations overview |
| ✅ | Products catalogue |
| ✅ | Suppliers directory |
| ✅ | Orders pipeline |
| ✅ | Bookings calendar + resources |
| ✅ | Low-stock style fields on products |
| ✅ | Operations APIs + RLS |
| ✅ | Operations AI add-on in marketplace (placeholder) |
| 🟡 | Booking buffer automation — not built |
| ⬜ | Product variants add-on |
| ⬜ | Public customer booking page |
| ⬜ | Advanced inventory / stock movements |
| ⬜ | Auto stock deduction from POS |
| ⬜ | Multi-location stock |
| ⬜ | Purchase order generator |
| ⬜ | Operations AI chat |

---

## 7. Sales module

| Status | Item |
|--------|------|
| ✅ | Sales overview |
| ✅ | POS page (basic) |
| ✅ | Leads list |
| ✅ | Sales AI add-on in marketplace (placeholder) |
| 🟡 | POS offline mode — not built |
| ⬜ | Dynamic DuitNow QR add-on |
| ⬜ | Refund/void approval |
| ⬜ | Daily close-out reconciliation |
| ⬜ | Sales by staff report |
| ⬜ | Coupon-to-sales tracking |
| ⬜ | Online storefront |
| ⬜ | Sales AI chat |

---

## 8. Marketing module

| Status | Item |
|--------|------|
| ✅ | Marketing overview + KPIs |
| ✅ | Customers CRM (list, detail, create, merge) |
| ✅ | CSV import / export |
| ✅ | Segments (create, rules, member preview) |
| ✅ | Broadcasts (compose, send, recipients) |
| ✅ | Coupons (create, redeem, validate) |
| ✅ | Content library + media upload |
| ✅ | Meta social connect / post / insights (OAuth) |
| ✅ | Customer analytics views |
| ✅ | Marketing AI add-on in marketplace (placeholder) |
| 🟡 | Tag refresh cron — Edge Function; pg_cron wiring optional |
| 🟡 | WhatsApp / email campaign channels — coming soon in Integrations UI |
| ⬜ | WhatsApp Business API add-on |
| ⬜ | Email campaign automation |
| ⬜ | TikTok/Shopee sync |
| ⬜ | CLV report |
| ⬜ | Loyalty & review tools |
| ⬜ | Marketing AI chat |

---

## 9. HR module

### 9.1 Core HR (Growth/Pro)

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
| ✅ | Leave history |
| ✅ | Limited AL balance (entitlement − taken, working days excl. weekends + holidays) |
| ✅ | Balance updates on approve/reject |
| ✅ | Soft warning when AL over balance |
| ✅ | Onboarding checklist per employee |
| ✅ | Default onboarding items on new employee |
| ✅ | Onboarding progress (employee + HR overview) |
| ✅ | IC/bank encryption at rest (AES-256-GCM sealed fields) |
| ✅ | Audit log on HR mutations |

### 9.2 HR add-ons

| Status | Add-on | Slug | Notes |
|--------|--------|------|-------|
| ✅ | HR AI Assistant (Hana) | `hr-assistant` | RM 20/mo · 100 credits · chat + daily notice |
| ✅ | Public Holiday Calendar | `hr-public-holidays` | Free · MyCal import · state-aware |
| ✅ | Staff Appraisal Checker | `hr-staff-appraisal` | RM 29/mo · schedule reviews · overdue tracking |
| 🟡 | Self-Service Leave Forms | — | Share link works; full portal add-on not built |
| ⬜ | Advanced Leave Policy | `hr-advanced-leave-policy` | ✅ Marketplace placeholder · UI at `/hr/leave/policy` |
| ⬜ | Contract & Letter Generator | `hr-contract-letters` | Coming soon in marketplace |
| ⬜ | Shift Roster | `hr-shift-roster` | Coming soon |
| ⬜ | Time Clock | `hr-time-clock` | Coming soon |
| ⬜ | Payroll & Statutory Pack | `hr-payroll-pack` | Coming soon |
| ⬜ | HR Reminder Pack | `hr-reminder-pack` | Coming soon |
| ⬜ | Staff Self-Service Portal | `hr-staff-portal` | ✅ Marketplace placeholder · UI at `/hr/staff-portal` |
| ⬜ | AL carry-forward automation | — | Ships with Advanced Leave Policy add-on |
| ⬜ | Per-business holiday overrides | — | Phase 2 HR feature · feeds Operations calendar (see §9.4) |
| ⬜ | Operations integration (block bookings on PH) | — | Phase 2 · consumes HR effective calendar (see §9.4) |

### 9.3 HR AI (Hana) capabilities

| Status | Capability |
|--------|------------|
| ✅ | Plain-language leave Q&A |
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
| ⬜ | Dedicated appraisal tools in chat (create/complete via Hana) |

### 9.4 Holiday overrides ↔ Operations (related, not the same)

| Piece | Owner | What it does | Status |
|-------|-------|--------------|--------|
| **Public holiday import** | HR | Federal + state days from MyCal API | ✅ (`hr-public-holidays`) |
| **Per-business holiday overrides** | HR | Add company closure, hide a gazetted day, or move a replacement day (`business_holiday_overrides` table) | ⬜ Phase 2 |
| **Effective working calendar** | HR | Imported holidays **merged with** overrides → used for leave day counting | 🟡 Leave uses holidays today; overrides not editable yet |
| **Operations integration** | Operations | Read the **same effective calendar** to block or warn on bookings during public holidays / company closures | ⬜ Phase 2 (after event outbox) |

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
| ⬜ | Cross-pillar event outbox (`leave.approved` → Ops) |

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
| ✅ | Run `supabase db push` if remote behind local — through `20260708120000` applied |
| ✅ | `NEXT_PUBLIC_APP_URL` set in production |
| ✅ | `CRON_SECRET` set in Vercel production |
| 🟡 | Set production env: `INTEGRATION_ENCRYPTION_KEY`, `ILMU_API_KEY` (or configure ILMU in super-admin integrations) — `ILMU_API_KEY` ✅ if set in Vercel |
| 🟡 | Configure Supabase Auth email templates / SMTP for team invites |
| ✅ | Vercel crons configured: `privacy-sweep`, `hr-daily-notice`, `hr-assistant-renewal`, `subscription-renewal`, `tenant-health` |
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
| `20260708150000_subscription_billing.sql` | RM0 subscription invoices, renewal cron, tier-change invoices |

---

## 13. Phase 2+ backlog (not started)

- Staff login self-service (`/hr/me`)
- Per-business public holiday overrides
- Operations ↔ HR holiday blocking
- Cross-pillar event bus / outbox
- **Onboarding Phase 2** — one-click bundle activate + discounted billing
- Paid HR add-ons: advanced leave, payroll, roster, time clock, contracts
- Module AI chat UIs (Marketing, Finance, Operations, Sales, Admin)
- Live Billplz checkout for credits and subscription
- Digital signature, approval workflows, advanced compliance

---

## How to update this file

1. When a feature ships, move it from ⬜ or 🟡 to ✅ and add a line to `docs/CHANGELOG.md`.
2. When something is half-built (UI without API, or API without migration), mark 🟡 with a short note.
3. Keep §12 in sync after each release so deploy steps are not missed.
