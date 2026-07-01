# Technical Infrastructure

> Stack decisions, non-functional requirements, and the reasoning behind each choice.

## 1. Stack at a Glance — LOCKED

| Layer | Choice | Why |
|-------|--------|-----|
| Hosting + frontend | **Vercel (Singapore edge)** | Next.js native; zero-ops deploys; preview environments per PR; CDN included. |
| Frontend framework | **Next.js (App Router) + React** | Single codebase for Desktop ERP + Mobile PWA. |
| PWA shell | **Service Worker + Web App Manifest** | "Add to Home Screen" install path; offline app shell caching; Web Push notifications. |
| Styling | **Tailwind CSS** | Utility-first; consistent thumb-friendly UI with minimal CSS overhead. |
| Backend | **Next.js Route Handlers + Supabase Edge Functions** | No separate Express server. One service to deploy. |
| Database + Auth + Storage + Realtime | **Supabase (Singapore region)** | Managed Postgres with **RLS** (the multi-tenancy + RBAC foundation), Auth built-in, S3-compatible storage, Realtime for cross-pillar UI updates. |
| AI provider | **OpenAI API — GPT-4o-mini** | Cost-efficient (~RM 0.005 per Boardroom chain); supports **strict JSON Schema** outputs which eliminate parser errors. |
| Payments | **Billplz** (primary) / **Curlec** (fallback) | Malaysian-native; FPX + Credit Card; recurring subscription support. |
| Transactional email + push | **Supabase Auth emails** + **Resend** for app emails + **Web Push** for mobile notifications | Picked to minimize vendor sprawl. |

The same Next.js codebase serves **two product modes** — see [dual-mode.md](./dual-mode.md) for what lives in each.

### Why this stack (vs. the original Node + Express + PG-on-VPS path)

| Decision | Original plan | Final | Why we changed |
|----------|---------------|-------|----------------|
| Backend service | Node + Express | **Next.js Route Handlers + Supabase Edge Functions** | One service, not two. No DevOps tax. |
| Database hosting | Self-managed Postgres | **Supabase managed Postgres** | RLS is a first-class feature → multi-tenancy + RBAC for free. No backup/HA ops. |
| Auth provider | TBD (Clerk vs Auth.js vs build) | **Supabase Auth** | Email/pass + OTP + magic links + JWT sessions all included. One less vendor. |
| Object storage | TBD (S3 vs R2) | **Supabase Storage** | S3-compatible, RLS-aware, one less vendor. |
| Job queue | TBD (BullMQ vs pg-boss) | **Supabase Edge Functions + Postgres triggers + Realtime** | Sufficient for v1 scale (thousands of users). Revisit at 10K+. |
| Hosting | Tencent Lighthouse / DO / AWS | **Vercel** | Next.js native; Singapore edge; zero-ops; PDPA-acceptable. |

## 2. Frontend

### Goals
- Sub-2s first contentful paint on a mid-range Android (e.g. Samsung A14) over 4G.
- Hot-path screens (POS grid, Task Matrix, Booking calendar) must hit the **5-second rule** end-to-end.
- General mobile execution actions must hit the **10-second rule**.
- Touch targets ≥ 44 × 44 px (Apple HIG) for thumb usability.

### Conventions
- **App Router** (Next.js 14+).
- TypeScript across the codebase.
- **Server Components** for read-heavy lists (transactions, customers, products); **Client Components** only for interactive widgets (kanban drag, calendar drag, POS).
- Form validation via Zod schemas — same schemas reused server-side for `JSON Schema` strict-mode AI outputs.
- State: prefer URL state and server state (TanStack Query) over global stores.
- Offline: explicit opt-in per feature (e.g. POS via the Hardware add-on uses a local IndexedDB queue).

### Mobile PWA specifics
- **Web App Manifest** with proper icons, theme color, and orientation lock.
- **Service Worker** caches the app shell (Workbox or hand-rolled).
- **Web Push notifications** for AI Morning Brief, low-stock alerts, leave requests. iOS 16.4+ supported; older iOS gets in-app + email fallback.
- **Camera API** integration for receipt and MC capture.
- **Web Share API** for native WhatsApp share sheet.
- Conditional rendering of mobile vs desktop component variants via a `useMode()` hook based on viewport + user-agent. The hook is the single switching mechanism; pages don't branch ad-hoc.

## 3. Backend

### API surface
- Next.js Route Handlers for thin CRUD endpoints (close to UI).
- Supabase Edge Functions for:
  - Long-running jobs (LHDN XML export, PDF generation).
  - The event dispatcher (cross-pillar sync — see [cross-pillar-sync.md](./cross-pillar-sync.md)).
  - Webhook receivers (Billplz, future DuitNow integration).

### Data access
- Single ORM choice TBD — likely **Prisma** (developer experience) or **Drizzle** (raw SQL transparency, RLS-friendly). _(Open question.)_
- All queries scoped by `business_id` via middleware; defense-in-depth with Postgres RLS.

### Background jobs
- Event dispatcher runs as a Supabase Edge Function reading from `events_outbox`.
- Redis/BullMQ vs Postgres-backed queue is deferred to the Scale stage.

## 4. Database

### Engine
- **PostgreSQL 15+** (managed — likely Supabase, Neon, or RDS; choice TBD).

### Multi-tenancy strategy
- **Shared schema, row-level isolation** via `business_id` on every table.
- Postgres RLS policies enforce isolation at the database level — application bugs cannot leak rows across tenants.

### Schemas of note
- `events_outbox` — transactional outbox for cross-pillar sync.
- `audit_log` — every mutation tagged with actor, IP, user-agent. Required for LHDN audit.
- `files` — Storage metadata; binary content lives in object storage (S3-compatible).

### Backups & retention
- Point-in-time recovery on the managed Postgres.
- Daily logical backups exported to cold storage.
- Retention policies per table TBD (especially `events_outbox` and `audit_log`).

## 5. AI Infrastructure

### Provider
- **OpenAI API**, model `gpt-4o-mini` for both per-pillar Agent calls and Executive Boardroom orchestration.

### Strict JSON Schema
- Every AI call uses **`response_format = { type: "json_schema", strict: true }`**.
- Each Agent has an input schema (its slice of pillar context) and an output schema (the structured rendering for the UI).
- This eliminates parsing errors and lets the frontend safely deserialize without regex.

### Trigger model
- AI is **never** wired to a free-text chat box.
- Every AI call is a **Structured Trigger** — a backend-generated event ("morning summary", "draft reminder for overdue invoice X") with a known schema.
- This guarantees predictable token budgets — see the credit accounting in [../ai/agents.md](../ai/agents.md).

### Boardroom orchestration
- Implemented as a **sequential orchestrator** in a Supabase Edge Function:
  1. Master orchestrator inspects the user prompt.
  2. Dispatches a per-Agent context slice (silencing irrelevant Agents — the "Relevance Safeguard Filter").
  3. Aggregates responses into a single structured Boardroom output.
- Each Agent's prompt is bounded by schema and a hard `max_tokens` ceiling.

### Cost guardrails
- **Credit pool** per Agent (100/month bundled).
- **Slow Mode** — when out of credits, requests are routed through a delay queue (15–20s response window) instead of being denied. This preserves UX while disincentivizing abuse.
- **Top-ups** restore Fast Mode immediately.

## 6. Payments

### Providers
- **Billplz** and/or **Curlec** for recurring monthly billing.
- Both support FPX (Malaysian online banking) and Credit Card.

### Subscription model
- Each business has one subscription per active product (base tier, each add-on, each AI Agent).
- Proration on activation, fixed cycle on deactivation. (Tier and price data lives in code under `lib/billing/tiers.ts`, not in docs.)
- Webhook handlers (`payment.success`, `payment.failed`, `subscription.cancelled`) drive feature gate state in real time.

### Failure handling
- On `payment.failed` → suspend add-ons + AI first; base tier suspends after a grace window (final TBD).
- All suspension/resumption events are logged to `audit_log`.

## 7. File Storage

- **Object storage** (S3-compatible — provider TBD: AWS S3, Cloudflare R2, Backblaze B2).
- Files referenced from Postgres via `files.id`; binary lives in the bucket.
- Sensitive flags (IC copies, bank documents, MC photos) enforce **server-side encryption with a per-tenant data key** (envelope encryption via KMS).
- Signed short-lived URLs for download; public share URLs use the hash convention in the [glossary](../glossary.md).

## 8. Auth & RBAC — Full 6-Role Model in v1

The full role model ships in v1. A Micro-tier kedai with 3 staff or an SME-tier salon with 8 staff genuinely needs the granularity — keeping the cashier out of payroll is a product requirement, not a future feature.

### Roles

| Role | Access |
|------|--------|
| **Owner** | Full system access (incl. billing + role assignment) |
| **Manager** | Operational control across active pillars; no billing/role assignment |
| **Accountant** | Finance module only |
| **HR Officer** | HR module only + Admin storage for HR docs |
| **Cashier** | POS surface only (within Sales pillar) |
| **Staff** | Assigned task board + Self-Service Leave only |

### Auth implementation (via Supabase Auth)

- **Provider:** Supabase Auth — no separate auth vendor.
- **Credentials:** email + password by default; magic links for staff invitations.
- **2FA:** WhatsApp/SMS OTP via Supabase phone auth, optional for Owner.
- **Sessions:** JWT (Supabase) in HttpOnly cookies. JWT claims include `role`, `business_id`.
- **Invite flow:** Owner enters phone/email → Supabase sends magic link → first-login sets password → role written to `users` table.

### Implementation pattern — One Permissions Matrix, Three Enforcement Layers

The complexity is real but bounded. The pattern:

```
                    ┌─────────────────────────────┐
                    │  lib/permissions.ts         │
                    │  (Single source of truth —  │
                    │  ~30 role × pillar rules)   │
                    └──────────────┬──────────────┘
                                   │ read by
        ┌──────────────────────────┼──────────────────────────┐
        v                          v                          v
┌──────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐
│ Postgres RLS     │  │ Next.js Middleware    │  │ <RequirePermission> │
│ (DB-level deny)  │  │ (API fast-fail)       │  │ (UI hide)           │
└──────────────────┘  └──────────────────────┘  └─────────────────────┘
```

**Each layer reads from the same matrix file.** Add a new pillar feature → add one row to the matrix → all three layers update.

### The Permissions Matrix Shape

```typescript
// Conceptual; actual file would have stricter types
export const permissions = {
  owner:      { admin: '*', finance: '*', ops: '*', marketing: '*', sales: '*', hr: '*', billing: '*', team: '*' },
  manager:    { admin: '*', finance: '*', ops: '*', marketing: '*', sales: '*', hr: '*' },
  accountant: { finance: '*' },
  hr_officer: { hr: '*', admin: { storage: 'rw_hr_docs_only' } },
  cashier:    { sales: { pos: 'rw' } },
  staff:      { admin: { tasks: 'assigned_only' }, hr: { leave: 'self_only' } },
};
```

The `'*'` means full access; the nested objects scope access to specific surfaces. Adding new actions = extending one object.

### Defense in depth (Supabase RLS-first)

| Layer | Role | When it fires |
|-------|------|---------------|
| **Postgres RLS policies** | Strongest — last line of defense | Every query that hits the DB |
| **Next.js API middleware** | Fast-fail + clean error | Every API route |
| **`<RequirePermission>` React component** | Hide forbidden surfaces | Every UI render |

### Test Strategy — Bounded, Not Exploding

The earlier "720 decisions" framing was misleading. The real test surface:

- **~30 positive tests** — each `(role × pillar)` combo that should succeed.
- **~30 negative tests** — each `(role × pillar)` combo that should return `403`.
- **~10 cross-cutting tests** — invariants like "no Staff can ever see another business's data" (RLS isolation).
- **~5 lifecycle tests** — role assignment, revocation, audit logging.

**Total: ~75 RBAC tests** — manageable, comprehensive, fast to run in CI.

Adding a new endpoint without an RLS policy or a `can()` middleware call fails CI.

### Phase 0 Build Investment

The RBAC foundation is built **once** in Phase 0 (Weeks 1–4) and amortized:

| Phase 0 deliverable | Effort |
|---------------------|--------|
| Permissions matrix (`lib/permissions.ts`) | ~1 day |
| `can(user, action, resource)` helper | ~2 days |
| `<RequirePermission>` React component | ~1 day |
| Next.js middleware wrapper | ~1 day |
| RLS policy generator helpers (template for new tables) | ~2 days |
| All 6 roles defined + JWT claims wired | ~3 days |
| Test harness for positive/negative RBAC | ~3 days |
| **Total** | **~2 weeks** |

After Phase 0, every new pillar feature is one matrix row + one RLS policy + one positive/negative test. The complexity is fully amortized.

### Open auth questions

- Multi-role per user (e.g. Manager + HR Officer in a small business) — Phase 2 or Phase 5? Start single-role in v1; revisit when a real customer asks for dual.
- Single sign-on for businesses that use Google Workspace — post-v1.
- Phone-only signup for kedai owners without email — Supabase supports it; UX flow TBD.

## 9. Observability

- **Structured logs** (JSON) shipped to a hosted log aggregator (Logtail, Better Stack, or Datadog — TBD).
- **Error tracking** — Sentry.
- **Metrics** — Prometheus-format scraped to a Grafana dashboard, or a hosted alternative.
- **AI usage metering** — every AI call writes a row to `ai_usage` with tokens consumed, cost in cents, business_id. Drives both per-business credit deduction and internal margin reporting.

## 10. Infrastructure Cost Model (Vercel + Supabase)

The system is engineered for **micro-SME-friendly margins from day one** — and the Vercel + Supabase choice ensures we **pay nothing until we have paying customers**.

### Stage-based infrastructure cost

| Stage | Paying users | Vercel | Supabase | Domain + Email | Total fixed RM/mo |
|-------|------:|--------|----------|----------------|---------------------:|
| **MVP** | 0–100 | Hobby (Free) | Free | ~RM 10 | **~RM 10** |
| **Growth** | 100–1,000 | Pro (~RM 90) | Pro (~RM 115) | ~RM 15 | **~RM 220** |
| **Scale** | 1,000–10,000 | Pro (~RM 90) | Team (~RM 600) | ~RM 30 | **~RM 720** |
| **Enterprise** | 10K+ | Custom | Custom | — | _Negotiate_ |

Why this is better than the original RM 75–85 estimate:
- **At MVP, fixed cost is ~RM 10/mo, not RM 80.** Free tiers carry the first 100 paying customers.
- **At Growth, we pay more (RM 220) but get managed Postgres + HA + RLS + Auth + Storage included.** Self-managing those on a Lighthouse VPS would cost ~10 hours/week of engineering time — far more expensive than RM 220.
- **The 99.9% uptime SLO becomes credible.** Vercel SLA + Supabase Pro SLA both include uptime commitments.

### Variable AI cost — ~RM 0.26 per active user / month (unchanged)

| Component | Cost driver | Approx. monthly cost (RM) |
|-----------|-------------|--------------------------:|
| AI calls (Daily Summary + Context Text + Aggregation) | structured triggers on GPT-4o-mini | ~0.20 |
| AI Boardroom runs (avg 4/month per eligible user) | ~RM 0.005 per run | ~0.02 |
| Storage growth + bandwidth | per-account uploads | ~0.04 |
| **Total variable** | | **~0.26** |

### Resulting margin at each stage

| Stage | Paying users | Total fixed (RM) | Total variable (RM) | MRR @ blended RM 100 | Gross margin |
|-------|------:|------:|------:|-----:|----:|
| MVP | 50 | 10 | 13 | 5,000 | **~99.5%** |
| Growth | 500 | 220 | 130 | 50,000 | **~99.3%** |
| Scale | 5,000 | 720 | 1,300 | 500,000 | **~99.6%** |

**Break-even on infrastructure: 1 paying customer at MVP stage.**

Salaries, marketing, and other operating expenses are separate (opex, not COGS).

### Cost-tracking acceptance criteria
- Per-business marginal infra cost is **derivable from logs and < RM 5/month at p95**.
- AI usage metering writes to `ai_usage` for every call (see [../ai/agents.md](../ai/agents.md) §6).
- A monthly cost report breaks down: Vercel / Supabase / OpenAI / Resend / per business.

### Migration path beyond Supabase Team

When scale demands more (10K+ active users, sub-100ms p95 across SEA):
- Move Postgres to a dedicated provider (Neon, AWS RDS ap-southeast-5 in KL for Malaysian data-residency story).
- Keep Vercel for hosting until usage exceeds Pro tier; then negotiate Enterprise.
- Re-evaluate Edge Functions vs dedicated worker service (Fly.io / Railway).

This migration is a Phase 5+ concern, not a Day-1 decision.

---

## 11. Non-Functional Requirements

| Concern | Target |
|---------|--------|
| Mobile PWA FCP (4G mid-Android) | < 2s |
| Desktop FCP | < 1.5s |
| Hot-path action (POS sale, task tick) | < 5s end-to-end |
| General mobile execution | < 10s end-to-end |
| API p95 latency | < 300 ms |
| AI Fast Mode response | < 2s (model-dependent) |
| AI Slow Mode response | 15–20s deterministic delay |
| **Uptime SLO** | **99.9%** |
| Backup RPO | ≤ 24 hours |
| Backup RTO | ≤ 4 hours |
| Security baseline | OWASP Top 10 mitigations; per-tenant RLS; encrypted at rest; **RBAC defense-in-depth (API + UI + DB)** |

## 12. Open Architecture Questions

Resolved with the Vercel + Supabase choice:
- ~~Managed Postgres provider~~ → **Supabase**.
- ~~Object storage provider~~ → **Supabase Storage**.
- ~~Deployment platform~~ → **Vercel**.
- ~~Auth provider~~ → **Supabase Auth**.
- ~~Job queue~~ → **Supabase Edge Functions + Postgres triggers + Realtime** (revisit at 10K+ users).

Still open:
- ORM: **Supabase JS client (built-in)** vs **Drizzle layered on top** — start with Supabase JS; add Drizzle if query complexity demands.
- Observability stack: **Vercel Analytics + Supabase logs + Sentry** as the default v1 trio; expand to Better Stack / Datadog at Scale stage.
- AI failover: single-vendor (OpenAI) at v1 is fine; revisit dual-vendor (OpenAI + Anthropic + Gemini) at Scale stage.
- Migrating to AWS ap-southeast-5 (KL) when Malaysian data-residency becomes a sales advantage — Phase 5+ decision.
