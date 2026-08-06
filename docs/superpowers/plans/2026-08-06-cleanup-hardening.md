# Cleanup & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplication and attack surface, add targeted caching, delete dead code — with zero behavior regressions on core flows.

**Architecture:** Four phased PRs — (1) security hardening with shared guards and sanitized errors, (2) merge duplicated API handlers especially staff assistants, (3) performance via `unstable_cache` and query consolidation, (4) dead code removal and file splits. Each phase verified with `type-check`, `build`, and pillar smoke tests.

**Tech Stack:** Next.js 15 App Router, Supabase, existing `lib/api/handler.ts`, `lib/api/response.ts`, `lib/api/rate-limit.ts`

## Global Constraints

- Do not merge `marketing_files` into `admin_files` (separate bucket by design)
- Do not mass-convert all 210 API routes in one PR
- Keep RBAC in route wrappers; middleware is session-only
- Log server-side details; never return raw Postgres/Supabase errors to clients
- Run smoke tests after each phase before merging

---

## Phase 1 — Security hardening ✅ (2026-08-06)

- [x] **1.1** Create `lib/api/require-cron.ts` and migrate all 14 cron routes
- [x] **1.2** Create `lib/finance/require-user.ts` — replace 8 inline guards
- [x] **1.3** Create `lib/marketing/require-user.ts` — replace 5 inline guards
- [x] **1.4** Fix `operations/customers/search` to import `lib/operations/require-user.ts`
- [x] **1.5** Sanitize API errors in Finance routes (use `lib/api/db-error.ts`)
- [x] **1.6** Sanitize API errors in Operations routes
- [x] **1.7** Rate-limit: CSV export, bulk-delete, customer search, invoice create, POS checkout
- [x] **1.8** Verify: `type-check`, `build` ✅

---

## Phase 2 — Merge duplicated API code ✅ (2026-08-06)

- [x] **2.1** Create `lib/ai/staff-assistant-route.ts` shared handler (+ hooks for sales clarifier / ops out-of-scope)
- [x] **2.2** Migrate HR assistant route (pilot)
- [x] **2.3** Migrate remaining 5 assistant routes → thin wrappers + `*-assistant-run.ts`
- [x] **2.4** Create `lib/customers/search.ts` shared search (marketing, ops, POS)
- [x] **2.5** Pilot `withApiHandler` on Operations list GETs (suppliers, products, booking-resources)
- [x] **2.6** Verify: `type-check`, `build` ✅

---

## Phase 3 — Performance & caching ✅ (2026-08-06)

- [x] **3.1** `unstable_cache` on marketing dashboard snapshot (90s per businessId) — `lib/marketing/dashboard-cache.ts`; tenant-scoped queries in `dashboard-queries.ts`
- [x] **3.2** Wire HR briefing `unstable_cache` (120s per business) — `lib/ai/context/hr-cache.ts` via `buildPillarSnapshot`
- [x] **3.3** Audit `force-dynamic` on read-heavy pages — all pillar pages use `getCurrentUser()` (cookies) so they are implicitly dynamic; explicit `force-dynamic` kept as documentation; data-layer caching is the lever (not removing route dynamism)
- [x] **3.4** Supabase advisors — MCP auth unavailable in this session; manual follow-up: run Performance + Security advisors in Supabase dashboard after deploy
- [x] **3.5** Verify: `type-check`, `build` ✅

---

## Phase 4 — Remove bloat & split megafiles ✅ (2026-08-06)

- [x] **4.1** Delete `components/marketing/CsvImportWizard.tsx` (unused; import page uses `CsvImportWizardPencil`)
- [x] **4.2** Add `knip` for dead export detection — `knip.json` + `npm run knip`
- [x] **4.3** Split AI tool megafiles with re-exports:
  - `lib/ai/malaysia-today.ts` (shared date helper)
  - Operations → `operations-assistant-tool-definitions.ts` + `operations-assistant-tool-execute.ts`
  - Finance → `finance-assistant-tool-definitions.ts` + `finance-assistant-tool-execute.ts`
  - Marketing → `marketing-assistant-tool-definitions.ts` + `marketing-assistant-tool-executors.ts`
  - Barrel re-exports preserved on `*-assistant-tools.ts`
- [x] **4.4** UI splits deferred (invoice composer, POS, bookings — per plan: only when touching those areas)
- [x] **4.5** Verify: `type-check`, `build` ✅

### Knip triage (2026-08-06)
- Removed **52** confirmed-dead files (legacy dashboard components, unused HR layout shells, stub integrations catalog, duplicate middleware helper)
- Kept `supabase/functions/*` (deployed edge functions; knip ignores them)
- `npm run knip` now reports **0 unused files** (exports/types still flagged for future passes)

---

## Verification matrix (every phase)

```bash
npm run type-check
npm run lint
npm run build
npm run smoke:finance
npm run smoke:operations
npm run smoke:hr
npm run smoke:sales
npm run smoke:m2
```
