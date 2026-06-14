# Implementation Changelog

> Running log of shipped changes to the running app, written for the next
> engineer to read top-down. Newest at the top. Cross-links the
> migrations, source files, and Pencil screens involved so a teammate can
> reproduce the state of the system without spelunking the git history.
>
> **Scope:** UI + backend changes wired through the app. Pure docs edits
> and copy-tweaks don't get an entry.

---

## 2026-06-14 · AI agent tenant isolation + briefing packets

**Goal:** make it structurally impossible for an AI agent to see another
tenant's data, and dramatically cut the token cost per invocation by
giving each pillar a pre-computed overview the agent reads instead of
"browsing" the DB.

### Subsystem layout (`lib/ai/context/`)

- **`types.ts`** — `AgentContext` (frozen identity envelope),
  `PillarSnapshot` (compact KPI + recent + attention shape),
  `BriefingPacket` (snapshot + rendered text).
- **`guard.ts`** — `resolveAgentContext()` (cached, pulls business_id
  from `getCurrentUser()`, **never** from request input);
  `assertTenantOnly()` defence-in-depth row check; new
  `TenantIsolationViolation` error class.
- **`client.ts`** — `createAgentScopedClient(ctx)` only ever returns the
  RLS-aware server client. Service-role is forbidden in agent code.
  `verifyRows()` wraps every query result through `assertTenantOnly`.
- **Per-pillar snapshot builders** (`admin.ts`, `finance.ts`,
  `marketing.ts`, plus `operations.ts` / `sales.ts` / `hr.ts`
  placeholders returning `available: false` until their migrations
  ship). Each builder caps recent-items at 10 and rolls up everything
  else to KPIs so the rendered briefing stays under ~2 KB.
- **`index.ts`** — registry + `buildPillarSnapshot(pillar, ctx)` and
  `buildBriefing(pillar, ctx)`. Both are `React.cache()`-memoised so
  the same request never double-loads.

### Wiring

- **`lib/ai/openai.ts`** gained a `briefingFor: Pillar` option. When
  set, `openaiChat()` auto-prepends the briefing as the first system
  message with a hard rule: *"You are answering questions strictly
  about ONE tenant. The data packet below is the only source of truth.
  Never reveal data from other tenants and never invent figures not in
  the packet."*
- **`GET /api/ai/context/[pillar]`** exposes the briefing for the
  caller's tenant only — useful for server-to-server agent calls and
  for a future "what does the AI see?" debug panel.

### Defence in depth — four overlapping guards

| Layer | Mechanism |
| --- | --- |
| Type | `AgentContext` is `Object.freeze`d; `businessId` cannot mutate. |
| Compile | Snapshot builders take `AgentContext` — forgetting it is a TS error. |
| Run-time | `verifyRows()` throws `TenantIsolationViolation` on any cross-tenant row. |
| Database | RLS `business_id = public.current_business_id()` policies (already in place). |

Removing any one layer still leaves three.

### Tests

- **`tests/ai-context-isolation.test.ts`** — verifies `assertTenantOnly`
  passes / throws as expected, that placeholder pillars emit the
  "no live data" disclaimer, and that rendered briefings never embed
  another tenant's id.

### Docs

- New [`docs/architecture/ai-context-isolation.md`](architecture/ai-context-isolation.md)
  covers the full data flow, the four-layer defence model, and the
  playbook for adding new pillars.

---

## 2026-06-14 · Platform integrations registry — unified API key management

**Goal:** stop scattering API keys across env vars and `.env.local` files.
Give the platform admin one screen to manage every third-party integration
(starting with OpenAI), with audit, encryption, and per-integration smoke
tests built in.

### Database

- **Migration 18** ([`supabase/migrations/00000000000018_platform_integrations.sql`](../supabase/migrations/00000000000018_platform_integrations.sql))
  introduces `public.platform_integrations` — one row per integration slug,
  with `enabled`, `config` (jsonb, non-secret), `encrypted_credentials`
  (jsonb AES-256-GCM payload), and lightweight smoke-test state
  (`test_status`, `last_tested_at`, `last_test_error`). RLS restricts to
  platform admins only.

### Catalog

- **`lib/integrations/catalog.ts`** — ~20 integration descriptors across
  10 categories (AI, Payments, Communication, Social, Maps, E-Invoicing,
  Logistics, Accounting, Analytics, Storage). Each descriptor carries
  field schema (text / secret / url / bool / select), docs URL, capability
  list, importance tier (core/recommended/optional), and a `wired` flag
  indicating whether code actually consumes it today. OpenAI and the
  existing Meta Graph integration are marked `wired: true`; the rest are
  catalog placeholders the platform team can fill out as features ship.
- Notable Malaysia-first inclusions: **LHDN MyInvois** (mandatory e-
  invoicing), **WhatsApp Business Cloud** (core comms channel for SMEs),
  **Billplz + iPay88** (local payment gateways), **Lalamove + EasyParcel**
  (last-mile delivery).

### Encryption + smoke tests

- **`lib/integrations/crypto.ts`** — AES-256-GCM helper. Keyed off
  `INTEGRATION_ENCRYPTION_KEY` (32-byte hex; falls back to scrypt
  derivation if a passphrase is provided). Each ciphertext is wrapped as
  `{ v, alg, iv, ct, tag }` so we can rotate cipher families later.
- **`lib/integrations/testers.ts`** — per-slug smoke tests. OpenAI hits
  `/v1/models`; WhatsApp Cloud hits `/v19.0/{phone_number_id}`; Resend
  hits `/domains`; Meta validates the app-token. Integrations without a
  cheap probe return `{ ok: true, message: 'No automated smoke-test
  defined.' }` so the admin can mark them known-good manually.

### API + UI

- **`/api/super-admin/integrations/[slug]`** — `GET` + `PATCH`. Platform-
  admin gated, body validated by Zod, secrets encrypted before persisting,
  every mutation written to `super_admin_audit`.
- **`/api/super-admin/integrations/[slug]/test`** — runs the smoke-test
  and stores the result.
- **`/super-admin/integrations`** — catalog grid grouped by category,
  with KPI tiles (enabled / wired / failing-test / categories) and a
  banner when `INTEGRATION_ENCRYPTION_KEY` is missing.
- **`/super-admin/integrations/[slug]`** — detail page rendering the
  field schema dynamically. Stored secrets show "•••••••• (saved — type
  to overwrite)" with a Clear button; never returned to the browser. The
  page includes Run-smoke-test + Save + edited-by metadata.
- **SuperAdminShell** nav got a new "Integrations" entry under CATALOG.

### Consumer pattern

- **`lib/ai/openai.ts`** — exemplar consumer demonstrating the
  `resolveIntegration("openai", { api_key: process.env.OPENAI_API_KEY })`
  pattern: read from the DB first, fall back to env. Existing
  deployments continue to work without changes.

### Operational

- **`.env.example`** got `INTEGRATION_ENCRYPTION_KEY` (required for
  saving secrets) and the optional `OPENAI_DEFAULT_MODEL` /
  `OPENAI_ORGANIZATION_ID` fallbacks.
- New doc [`docs/architecture/integrations.md`](architecture/integrations.md)
  covers the schema, encryption model, consumer pattern, and playbook
  for adding new integrations.

---

## 2026-06-14 · Demo seed — 5 dummy tenants with marketing payload

**Goal:** ship a one-command demo seed so every screenshot, investor demo,
and onboarding session has stable, realistic-looking data instead of an
empty tenant.

- **`scripts/seed-demo-businesses.ts`** — idempotent seed that creates
  five complete tenants (Nasi Lemak Berkat KL, Studio Klasik Photography
  Selangor, Bengkel Auto Maju Johor, Toko Bunga Sayang Ibu Penang, Salon
  Anggun Beauty Negeri Sembilan). Each tenant gets an owner auth-user, the
  required PDPA consent rows, **2–10 customers** with Malaysian names + manual
  tags + spend history, and **1–5 social-media posts** spread across TikTok /
  Instagram / Facebook (mostly `posted`, one `scheduled` for the future
  feed). Deterministic UUIDs + onConflict make re-runs safe.
- **`npm run seed:demo`** — new package script. The shared owner password
  defaults to `DemoPassword!2026`; override with `DEMO_OWNER_PASSWORD` env.
- README "Getting started" updated with the optional step.

---

## 2026-06-14 · PDPA compliance — data-subject rights end-to-end

**Goal:** make Bantu Niaga first-class compliant with Malaysia's
Personal Data Protection Act 2010 (with 2024 amendments). Ships every
data-subject right (s.30) plus the public-facing artifacts (privacy
notice, retention schedule, DPO contact, sub-processor list).

### Database

- **Migration 17**
  ([`supabase/migrations/00000000000017_pdpa.sql`](../supabase/migrations/00000000000017_pdpa.sql))
  introduces four PDPA-specific tables and two ALTER columns:
  - `data_subject_requests` — canonical log of every DSR with a status
    machine (`pending`/`in_progress`/`awaiting_grace`/`completed`/
    `cancelled`/`failed`) and a `scheduled_for` due-date that powers the
    grace-period worker. RLS lets users see only their own; platform
    admins see everything.
  - `user_consents` — one row per `(user_id, kind)` with the seven
    catalog kinds (terms_of_service, privacy_notice, marketing_email,
    product_updates, ai_training, analytics, third_party_share).
    Required consents are gated by API logic — the user must close the
    account to withdraw them.
  - `data_exports` — short-lived JSONB cache of generated bundles with a
    hard 7-day expiry (auto-purged by the sweep RPC).
  - `users.deletion_requested_at | deletion_scheduled_for | deleted_at`
    and the same triple on `businesses` — soft-delete bookkeeping that
    the UI uses to banner pending closures.
  - `privacy_execute_pending_deletions()` RPC — the hourly worker that
    clears PII columns and emits a `(request_id, kind, user_id,
    business_id)` set so the calling worker can also delete the matching
    `auth.users`.

### Server

- **`lib/privacy/*`** — colocated subsystem:
  - `types.ts` — `DsrKind`, `DsrStatus`, `ConsentKind`, etc.
  - `schemas.ts` — Zod validators for every API surface.
  - `catalog.ts` — the closed catalog of consents + retention schedule
    + `ACCOUNT_DELETION_GRACE_DAYS = 30`. Storing the copy in code (not
    DB) gives us version-controlled proof of what the user saw.
  - `load.ts` — `React.cache()`-memoised loaders (`loadConsents`,
    `loadUserDsrs`, `loadAllDsrs` for cross-tenant admin view) and the
    `buildExportBundle()` builder that aggregates every personal-data
    category we hold for a user.

### APIs (all `app/api/privacy/*`)

| Endpoint                               | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `POST /api/privacy/export`             | s.30 right-to-access — generates a JSON bundle, returns id  |
| `GET  /api/privacy/export/[id]`        | Downloads the bundle (24h `Cache-Control: no-store`)        |
| `POST /api/privacy/delete`             | Schedules a soft-delete (30-day grace)                       |
| `DELETE /api/privacy/delete`           | Cancels a pending deletion                                   |
| `GET  /api/privacy/consents`           | Returns merged consent state with the static catalog         |
| `POST /api/privacy/consents`           | Toggles consents; required-consent withdrawals are rejected  |
| `GET  /api/privacy/requests`           | Last 20 DSRs for the current user                            |
| `GET  /api/cron/privacy-sweep`         | Hourly worker; `Authorization: Bearer CRON_SECRET`           |

Every route uses the standardised response envelope from
`lib/api/response.ts`, picks up `X-Request-Id` from middleware, and is
rate-limited where it makes sense (3 exports/hour/user, 5 delete
attempts/hour/user).

### UI

- **`/settings/privacy`** is the user-facing surface. Cards:
  - **Download my data** — one-click export with size + expiry feedback.
  - **Close my account** — `DELETE`-confirmation gate, scope chooser
    (owner can pick user-only or whole tenant), reason field.
  - **Consent preferences** — toggle matrix with disabled required
    consents and a per-row "last granted" timestamp.
  - **Retention schedule** — published categorical retention windows.
  - **Recent privacy requests** — chronological DSR audit table.
  - A top-of-page warning banner appears when a deletion is awaiting
    grace, with the exact hard-delete date.
- **`/legal/privacy`** + **`/legal/terms`** — public, indexable pages
  rendered through a stripped-down `app/legal/layout.tsx`. The privacy
  notice re-uses the same retention schedule from `lib/privacy/catalog.ts`
  so the user-facing settings page and the public notice can never drift.
- **`/super-admin/privacy`** — cross-tenant DSR queue for the platform
  admin, with KPI tiles (pending / awaiting grace / completed / failed)
  and a server-rendered table. Added to `SuperAdminShell` nav under
  Operate.
- **Settings index** gained a "Privacy & data (PDPA)" card in the
  Security group.

### Sign-up flow

- `POST /api/auth/sign-up` now persists explicit `terms_of_service` and
  `privacy_notice` consents in `user_consents`, stamped with the IP,
  user-agent, and `PRIVACY_POLICY_VERSION` env var. The audit log entry
  includes the policy version so we can prove which copy was accepted.

### Operations

- **`vercel.json`** schedules the privacy sweep hourly. Self-hosted
  installs can replicate with any cron + `Authorization: Bearer
  CRON_SECRET` header.
- **`.env.example`** gained `PRIVACY_POLICY_VERSION` and `CRON_SECRET`.

### Docs

- New [`docs/architecture/pdpa.md`](architecture/pdpa.md) covers the
  schema, the deletion state machine, the export bundle contents, and
  the playbook for adding new consents.

---

## 2026-06-14 · Platform hardening — enterprise security + perf pass

**Goal:** raise the whole repo to enterprise-grade defaults without per-route
rewrites. Every change is additive (new helpers + tighter defaults) so no
existing behaviour is altered.

### Security

- **CSP + security headers** ([`next.config.mjs`](../next.config.mjs)) — strict
  Content-Security-Policy with `frame-ancestors 'none'` (clickjacking),
  HSTS preload, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a deny-by-default `Permissions-Policy`
  (no geo, camera, mic, payment, FLoC), and `X-Permitted-Cross-Domain-Policies: none`.
  `connect-src` is dynamically scoped to your Supabase project host. Meta
  CDNs are allowed for `img-src` so connected-Page avatars render.
- **Authenticated routes are never CDN-cached** — `Cache-Control:
  private, no-store, max-age=0` is set globally on `/api/*` and
  `/super-admin/*` at the edge AND by the API response helpers
  (belt-and-suspenders).
- **Rate limiting** ([`lib/api/rate-limit.ts`](../lib/api/rate-limit.ts)) —
  fixed-window token-bucket keyed on `(bucket, userId|ip)`. Applied to
  `/api/social/meta/post` (30/min/user) and `/api/social/meta/insights/[id]`
  (60/min/user) as exemplars. Standard `X-RateLimit-*` + `Retry-After`
  headers. In-memory for now; doc inside the file shows the Upstash/Redis
  swap path.
- **Request-id propagation** ([`middleware.ts`](../middleware.ts)) — every
  inbound request is stamped with `x-request-id` (re-using the caller's
  value when present). Threaded through the logger and into every
  API response so support tickets can be traced end-to-end.
- **OAuth callback hardening**
  ([`app/api/social/meta/callback/route.ts`](../app/api/social/meta/callback/route.ts))
  — redirect target is now built from a parsed URL (rejects tampered
  `NEXT_PUBLIC_APP_URL`); `detail` query param is stripped of CRLF/NUL and
  non-printable chars (response-splitting defence) and capped at 100 chars.
- **`robots: noindex`** on the authenticated app shell and the entire
  `/super-admin/*` surface so the admin app can't end up in Google.
- **`server-only` import guards** on `lib/social/meta.ts`,
  `lib/social/load.ts`, `lib/logger.ts`, `lib/api/handler.ts` so any
  accidental client-side import becomes a build error.
- **Token redaction in logs** — `lib/logger.ts` redacts `access_token`,
  `password`, `client_secret`, `api_key`, etc. at any nesting depth,
  and replaces strings that look like JWTs with `[REDACTED_TOKEN]`.

### Performance

- **`React.cache()` on hot loaders** —
  [`getCurrentUser`](../lib/auth/current-user.ts),
  [`loadSocialAccounts`](../lib/social/load.ts),
  [`loadActiveSocialAccounts`](../lib/social/load.ts),
  [`loadCatalog`](../lib/marketplace/load.ts) are now request-scoped
  memoised. Server Components that call them multiple times in a single
  render tree share one Supabase round-trip instead of N.
- **Better images** — `next.config.mjs` enables AVIF/WebP, sets a 60s
  minimum cache TTL, and registers Meta + IG CDNs. `next/image` swapped
  in for the connected-account avatar on `/settings/integrations`.
- **Health probe** — [`/api/health`](../app/api/health/route.ts) now
  actually pings the DB (`count exact head true` on `businesses` — cheapest
  Supabase round-trip), returns latency, switches to `503` when degraded.
  Cached `s-maxage=5` so an over-eager uptime monitor cannot DDoS the DB.

### Reusable enterprise helpers (new)

| File | Purpose |
| --- | --- |
| [`lib/logger.ts`](../lib/logger.ts) | Structured logger. JSON in prod (Vercel/Datadog-parseable), pretty in dev. Redacts secrets. Levels filterable via `LOG_LEVEL`. `child()` for tagged sub-loggers. |
| [`lib/api/response.ts`](../lib/api/response.ts) | `ok / created / noContent / badRequest / unauthorized / forbidden / notFound / conflict / unprocessable / tooManyRequests / serverError`. Standard envelope `{ ok, data \| error, requestId }`. |
| [`lib/api/rate-limit.ts`](../lib/api/rate-limit.ts) | `consume({ bucket, identifier, limit, windowMs })`, `rateLimitHeaders()`, `clientIdentifierFromHeaders()`. |
| [`lib/api/handler.ts`](../lib/api/handler.ts) | `withApiHandler({ module, auth, rateLimit }, fn)` HOF — drop-in for new route handlers; gives you auth, rate-limit, request-id, error envelopes for free. |
| [`lib/security/cookies.ts`](../lib/security/cookies.ts) | `secureCookie() / clearedCookie()` so no future cookie ships without httpOnly + secure + sameSite set correctly. |

### Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — clean. Bundle sizes unchanged or slightly smaller
  (`/settings/integrations` 2.99kB → 2.54kB after the `next/image` swap).
- All five new social API routes still register.

---

## 2026-06-14 · Marketing M7 — Meta (Facebook + Instagram Business) integration

**Goal:** let tenants connect their Facebook Pages and the linked Instagram
Business accounts, publish a `content_plan` entry directly through the system,
and pull live impressions / reach / engagement from the Graph API into the
Content Detail screen. No API fees — Meta Graph is free; we use the standard
OAuth + Page-token flow. Platform owner sets the App ID/Secret once in
`.env`; every tenant on the server can then click "Connect with Facebook".

**Designed in Pencil first.** New screen "Screen — Settings / Integrations
(Meta)" added to `pencil-new.pen` showing the info banner, channel cards
and connected-account rows. UI in code follows the same layout.

**Database — migration [`00000000000016_social_integrations.sql`](../supabase/migrations/00000000000016_social_integrations.sql)**

- New tables: `social_accounts`, `social_post_publishes`, `social_post_metrics`.
- Tenant-scoped via `business_id`; RLS uses the standard
  `current_business_id() OR is_platform_admin()` pattern.
- `social_accounts` is keyed by `(business_id, provider, external_id)` so
  re-running OAuth upserts existing rows.

**New runtime code**

- [`lib/social/meta.ts`](../lib/social/meta.ts) — Graph API client. Wraps
  OAuth (`buildAuthUrl`, `exchangeCodeForToken`, `getLongLivedUserToken`),
  page discovery (`listUserPages`, `getIgBusinessForPage`),
  publishing (`publishFacebookPagePost`, `publishInstagramPost`), and
  insights normalisation (`getFbPostInsights`, `getIgMediaInsights`).
  Includes `isMetaConfigured()` + `missingMetaEnvVars()` so the UI can show
  a "Configure env first" hint instead of a broken button.
- [`lib/social/load.ts`](../lib/social/load.ts) — RLS-aware server loaders:
  `loadSocialAccounts`, `loadActiveSocialAccounts`,
  `loadAccountWithTokenForPublish` (server-only), `loadPublishesForContent`.
- [`lib/social/types.ts`](../lib/social/types.ts) — shared TypeScript types.

**API routes**

- `GET  /api/social/meta/connect` — verifies session + surface, mints a
  CSRF state cookie, redirects to Meta's OAuth dialog.
- `GET  /api/social/meta/callback` — verifies state, exchanges code → short
  → long-lived user token, upserts one `social_accounts` row per Page and
  one per linked IG Business account, audits the connect, redirects back
  to `/settings/integrations?meta=connected`.
- `POST /api/social/meta/disconnect` — marks `status='disconnected'` and
  zeros the access token. Optional `cascadeProvider: 'both'` also
  disconnects the IG row linked to the same Page.
- `POST /api/social/meta/post` — publish a `content_plan` entry to one or
  more accounts. Opens a `social_post_publishes` row first (audit trail),
  then calls Graph. Partial failures are returned per-account, not as 500.
  Advances `content_plan.status` to `posted` when at least one succeeds.
- `GET  /api/social/meta/insights/[publishId]` — pulls fresh metrics from
  Graph and inserts a new `social_post_metrics` row. Always-fresh by
  design (no background sync in v1).

**UI**

- [`app/(app)/settings/integrations/page.tsx`](../app/(app)/settings/integrations/page.tsx)
  rewritten to load real connected accounts. Shows a warning banner when
  `META_APP_ID`/`META_APP_SECRET` are missing, with a link to
  `developers.facebook.com/apps`. Each channel card shows live connected
  accounts with picture, name, username (IG), and a per-account
  Disconnect button. Facebook + Instagram cards are wired; TikTok and
  WhatsApp are still placeholders with "Coming soon" badges.
- [`components/settings/integrations/CallbackToast.tsx`](../components/settings/integrations/CallbackToast.tsx)
  surfaces a success/error toast after the OAuth callback redirects back.
- [`components/marketing/social/PublishPanel.tsx`](../components/marketing/social/PublishPanel.tsx)
  added to `/marketing/content/[id]`. Filters connected accounts to the
  entry's channel (FB ↔ facebook, IG ↔ instagram), pre-selects them all,
  surfaces caption + optional image URL inputs, and posts to the Graph
  endpoint. IG requires a public image URL — the panel disables Publish
  until one is provided when any IG account is selected.
- [`components/marketing/social/InsightsPanel.tsx`](../components/marketing/social/InsightsPanel.tsx)
  renders a per-publish metric card list with permalink + refresh button.
  Each Refresh hits `/api/social/meta/insights/[publishId]` and re-fetches.

**Env vars (server-only)**

```
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:3000/api/social/meta/callback   # optional; falls back to NEXT_PUBLIC_APP_URL
```

Added to [`.env.example`](../.env.example) with set-up instructions and a
link to the Meta developer portal.

**Docs**

- New: [`docs/architecture/social-integrations.md`](architecture/social-integrations.md)
  — full architecture brief (DB schema, OAuth flow, publish flow, insights
  flow, security notes, and a "how to add another provider" recipe).

**Status:** ready for staging once an App ID/Secret are added to `.env`.
No customer code change required to enable per-tenant — they just click
"Connect with Facebook" on their Settings → Integrations page.

---

## 2026-06-14 · Super-admin (platform admin) app

**Goal:** give Bantu Niaga staff a dedicated, cross-tenant control plane to
monitor activity and operate the platform — users, tenants, plans,
marketplace, AI agents, and the investor-pitch data monitor — without
loosening tenant RLS or mixing the surface into the customer-facing app.

**Designed in Pencil first.** Eight screens (overview, users, businesses,
plans, marketplace, AI agents, AI agent detail, data monitor) plus a
reusable dark-theme sidebar — see `pencil-new.pen` Super Admin section.

**Database — migration [`00000000000015_super_admin.sql`](../supabase/migrations/00000000000015_super_admin.sql)**

- New tables: `platform_admins`, `ai_agents`, `ai_agent_versions`,
  `ai_agent_usage_daily`, `super_admin_audit`.
- New helper `public.is_platform_admin()` used by RLS additions on
  `businesses`, `users`, `audit_log`, `invoices`, `credit_ledger`,
  `business_addons`, and the AI agent tables (read across tenants for
  platform admins only).
- New column `marketplace_addons.status` (`live` | `draft` | `disabled`)
  and `users.is_suspended` for soft suspensions.
- RPCs (all `security definer`, `is_platform_admin()`-checked):
  `super_admin_grant_admin`, `super_admin_set_business_status`,
  `super_admin_set_user_role`, `super_admin_save_agent_version`,
  `super_admin_set_marketplace_status`.
- Seeds six AI agents (Maya, Operations AI, Finance AI, Boardroom AI,
  HR Helper, Concierge) each with a v1.0.0 published scope/guardrails
  bundle and 30 days of deterministic usage data on the demo tenant.
- Bootstraps `asyraf@bantuniaga.demo` as the founding platform admin.

**Auth + middleware**

- New guard [`lib/auth/require-platform-admin.ts`](../lib/auth/require-platform-admin.ts)
  with `requirePlatformAdmin()` (redirects non-admins) and
  `isPlatformAdmin()` (soft check).
- [`middleware.ts`](../middleware.ts) matcher now includes
  `/super-admin/:path*` so Supabase session refresh runs there.

**Impersonation**

- [`lib/auth/impersonation.ts`](../lib/auth/impersonation.ts) — cookie
  primitives (`bn_impersonate`, 1h TTL, base64url JSON).
- [`lib/auth/current-user.ts`](../lib/auth/current-user.ts) now resolves
  the impersonation target (via service-role) when the cookie is set,
  returning a `CurrentUser` with `impersonatedBy` populated.
- [`app/api/super-admin/impersonate/route.ts`](../app/api/super-admin/impersonate/route.ts)
  POST starts a session (sets cookie, audits, returns redirect target),
  DELETE stops it.
- [`components/super-admin/ImpersonationBanner.tsx`](../components/super-admin/ImpersonationBanner.tsx)
  + [`ImpersonationBannerClient.tsx`](../components/super-admin/ImpersonationBannerClient.tsx)
  render a sticky yellow banner from `app/(app)/layout.tsx` whenever
  the cookie is active — admin email, target name, TTL, stop button.

**Pages — `app/(super-admin)/super-admin/**`**

- `layout.tsx` calls the guard and wraps children in
  [`SuperAdminShell`](../components/super-admin/SuperAdminShell.tsx)
  (dark sidebar with three nav groups: Operate, Catalog, Insights, plus
  a Back-to-tenant-app link).
- Overview, Users, Businesses, Plans, Marketplace, AI Agents (list +
  detail), Data monitor, Investor metrics, and Audit log pages.
- Reusable primitives:
  [`PageTopbar`](../components/super-admin/PageTopbar.tsx),
  [`primitives.tsx`](../components/super-admin/primitives.tsx)
  (`PageBody`, `KpiCard`, `StatusPill`, `ToggleVisual`, `Section`,
  formatting helpers), [`Sparkline`](../components/super-admin/Sparkline.tsx).
- Client actions:
  [`UserRowActions`](../components/super-admin/UserRowActions.tsx)
  (impersonate + row menu with suspend/restore/reset password/delete),
  [`MarketplaceToggle`](../components/super-admin/MarketplaceToggle.tsx),
  [`AgentScopeEditor`](../components/super-admin/AgentScopeEditor.tsx)
  (system prompt + allowed actions + guardrails + escalation +
  knowledge sources, save-as-draft or publish).

**Server loaders — [`lib/super-admin/load.ts`](../lib/super-admin/load.ts)**

All super-admin reads go through these helpers, which use the
service-role client (after the route layout's guard) to bypass tenant
RLS deliberately:

- `loadOverview()` — platform KPIs, plan mix, weekly tenant growth,
  recent activity (rolled up from `audit_log`).
- `loadUsers()`, `loadBusinesses()`, `loadMarketplaceAdmin()`.
- `loadAgents()` + `loadAgentDetail(slug)` with 7-day usage aggregation
  from `ai_agent_usage_daily` and per-agent sparkline buckets.
- `loadDataMonitor()` — counts across invoices, AI invocations, events,
  add-ons, credit ledger, customers; top contributing tenants.

**API routes — `app/api/super-admin/**`**

- `users/[id]` (PATCH: suspend/restore/set_role/reset_password, DELETE)
- `users/invite` (POST)
- `businesses/[id]` (PATCH: set_status, set_tier)
- `marketplace/[id]` (PATCH: status toggle)
- `agents/[slug]` (PUT: save scope version, optionally publish)
- `impersonate` (POST/DELETE)

Every mutation re-asserts `requirePlatformAdmin()` and writes a row to
`super_admin_audit`.

**Docs**

- New [`docs/architecture/super-admin.md`](architecture/super-admin.md)
  walks teammates through the mental model, schema, auth flow,
  impersonation, AI scope versioning, and bootstrap.

---

## 2026-06-14 · Marketplace IA cleanup (Pencil + code)

**Goal:** rename the engineer-flavoured "Cross-cutting" bucket into
something an SME owner understands, and let every requested pillar tab
appear in the Marketplace.

**Changes**

- Migration [`00000000000014_marketplace_categories.sql`](../supabase/migrations/00000000000014_marketplace_categories.sql) re-classifies
  the `storage-10gb` add-on from the catch-all `cross` pillar to `admin`
  and seeds two HR add-ons:
  - `payroll-bank-export` (RM 20/month — Maybank · CIMB · Public Bank · RHB).
  - `holiday-calendar-sync` (included on `sme`/`enterprise` — auto-imports
    Malaysia federal + state public holidays into the HR leave calendar).
- [`components/marketplace/MarketplaceView.tsx`](../components/marketplace/MarketplaceView.tsx)
  reorders the tab strip to: `Admin · HR · Finance · Operations ·
  Marketing · Sales · AI agents · All add-ons · Active`. Every pillar tab
  now renders even with zero results, with a friendlier empty-state copy
  ("No Operations add-ons available yet — more coming soon").
- [`components/shells/desktop-shell.tsx`](../components/shells/desktop-shell.tsx)
  and [`app/(app)/more/page.tsx`](../app/(app)/more/page.tsx): sidebar
  group label "Cross-cutting" renamed to **Platform**.
- [`app/(app)/marketplace/page.tsx`](../app/(app)/marketplace/page.tsx):
  page eyebrow changed from "Cross-cutting" to "Marketplace" and the
  heading from "Marketplace" to "Add-ons & integrations".

**No code references the `cross` pillar string in the filter UI any
more**, but the `AddonPillar` TS union and the DB check constraint still
include `'cross'` for backward compatibility (existing rows aren't
purged, and a future "shared utility" add-on could re-use the value).

---

## 2026-06-14 · Tier → pillar entitlements

**Goal:** make the four plan tiers gate which pillar modules a business
can open, per the founder's matrix:

| Tier            | Pillars unlocked                              |
|-----------------|-----------------------------------------------|
| Free (starter)  | Finance                                       |
| Plus (micro)    | Finance · Admin · Operations                  |
| Growth (sme)    | Finance · Admin · Operations · Sales · HR     |
| Pro (enterprise)| Finance · Admin · Operations · Sales · HR · Marketing |

See [`architecture/entitlements.md`](./architecture/entitlements.md) for
the full architecture write-up.

**Changes**

- New shared module
  [`lib/auth/entitlements.ts`](../lib/auth/entitlements.ts): `Pillar`
  type, `TIER_PILLARS` matrix, `hasPillar`, `minimumTierFor`,
  `pillarFromPath`. Single source of truth for every guard layer.
- New server helper
  [`lib/auth/require-pillar.ts`](../lib/auth/require-pillar.ts):
  `await requirePillar('marketing')` redirects to
  `/settings/subscription?locked=marketing` when the current business's
  tier doesn't include the pillar.
- Pillar layouts call the guard:
  - `app/(app)/admin/layout.tsx`
  - `app/(app)/operations/layout.tsx`
  - `app/(app)/sales/layout.tsx`
  - `app/(app)/hr/layout.tsx`
  - `app/(app)/marketing/layout.tsx`
  - Finance has no layout — every tier includes it.
- `app/(app)/layout.tsx` is now an `async` server component that loads
  the business's tier and forwards it to `<AdaptiveShell tier={tier} />`
  so both shells can render lock indicators.
- Desktop sidebar
  ([`components/shells/desktop-shell.tsx`](../components/shells/desktop-shell.tsx))
  and mobile bottom-nav
  ([`components/shells/mobile-shell.tsx`](../components/shells/mobile-shell.tsx))
  show a lock icon on disabled pillars and rewrite the href to the
  upgrade page. The mobile More page
  ([`app/(app)/more/page.tsx`](../app/(app)/more/page.tsx)) does the same
  with an inline `Plus`/`Growth`/`Pro` badge on locked items.
- Home pillar tiles
  ([`app/(app)/home/page.tsx`](../app/(app)/home/page.tsx)) replace the
  metric block with "Locked — upgrade to **Plus** to unlock" for any
  pillar the current tier doesn't include.
- Subscription page
  ([`components/settings/SubscriptionView.tsx`](../components/settings/SubscriptionView.tsx))
  reads `?locked=<pillar>` and renders a yellow "Switch to Plus to access
  the Admin module" banner.
- Plan catalog
  ([`lib/settings/plans.ts`](../lib/settings/plans.ts)) re-skinned:
  - Free (RM 0) · Plus (RM 80) · Growth (RM 120, "Most popular") · Pro
    (RM 220).
  - Each tier's `features` list now states explicitly which pillars are
    unlocked.

**Database**

- Migration
  [`00000000000013_tier_enterprise.sql`](../supabase/migrations/00000000000013_tier_enterprise.sql):
  widens `businesses.tier` check to allow `'enterprise'` and updates the
  `settings_change_tier` RPC's input guard to match. Owners can now
  self-switch to the Pro tier from the UI (previously a `mailto:` link).
- [`lib/settings/business.ts`](../lib/settings/business.ts) and
  [`lib/settings/schemas.ts`](../lib/settings/schemas.ts) TypeScript types
  widened to `'starter' | 'micro' | 'sme' | 'enterprise'`.

**Behaviour invariants** (rely on these when writing new pillar code)

- Reaching `/admin/anything` while on a tier without admin always lands
  on `/settings/subscription?locked=admin`. Don't add manual checks in
  page components — the layout guard already runs.
- The sidebar's `tier` prop is the canonical source for "is this
  business on plan X right now" in client code. Don't query
  `businesses.tier` from a client component.

---

## 2026-06-14 · Authentication core (sign-up · forgot · reset)

**Goal:** unblock self-serve onboarding without leaning on Supabase
Studio.

**Changes**

- New Zod schemas
  [`lib/auth/schemas.ts`](../lib/auth/schemas.ts) — `signUpSchema`,
  `forgotPasswordSchema`, `resetPasswordSchema`. Password strength rules
  enforce 12 chars + upper/lower/digit.
- API routes:
  - `POST /api/auth/sign-up` — creates the Supabase auth user via the
    admin API (auto-confirmed for the demo), seeds `public.businesses`
    (Starter, trial) + `public.users` (owner), audit log, credit ledger.
    Rolls back on failure.
  - `POST /api/auth/forgot-password` — calls `auth.resetPasswordForEmail`.
    Always returns 200 to prevent enumeration.
  - `POST /api/auth/reset-password` — validates an active recovery
    session, applies the new password, bumps
    `users.last_password_change_at`, audit-logs the change.
- New route `app/auth/callback/route.ts` exchanges Supabase email-link
  codes for a session and bounces to `next` (recovery / signup confirm /
  magic link). Failures land on `/sign-in?auth_error=…`.
- Shared UI
  [`components/auth/AuthShell.tsx`](../components/auth/AuthShell.tsx)
  for the two-column brand/form layout (matches `pencil-new.pen`).
  - `app/sign-up/page.tsx` — business + email + password, password
    strength validator.
  - `app/forgot-password/page.tsx` — email-only, success state.
  - `app/reset-password/page.tsx` — checks for a valid recovery session
    before letting the form submit.
- Sign-in page
  ([`app/sign-in/page.tsx`](../app/sign-in/page.tsx)) updated to use
  `AuthShell`, link the new flows, and surface `auth_error` from the
  callback.

---

## 2026-06-14 · Marketplace backend + UI (M1)

**Goal:** ship a functional add-on switchboard backed by Supabase.

**Database**

- Migration
  [`00000000000011_marketplace_m1.sql`](../supabase/migrations/00000000000011_marketplace_m1.sql) creates:
  - `public.marketplace_addons` — global catalog (public read).
  - `public.business_addons` — per-business activation state (RLS:
    owner-only read/write, scoped to current business).
  - RPCs `marketplace_activate_addon(slug, qty)` and
    `marketplace_deactivate_addon(slug)` — atomic activation /
    deactivation with prorated invoicing + audit log.
- Migration
  [`00000000000012_marketplace_m1_fixes.sql`](../supabase/migrations/00000000000012_marketplace_m1_fixes.sql)
  fixes the activate RPC to use `invoices.amount_myr` + `period_label`
  instead of the (non-existent) `amount_cents` + `meta` columns.
- 8 add-ons seeded (WhatsApp Business API, Extra staff seat, Extra
  10 GB storage, Boost Credits 300, TikTok Shop sync, LHDN e-Invoice,
  Boardroom AI digest, Shopee Mall sync). Two are pre-activated for the
  demo business.

**App**

- `lib/marketplace/types.ts` — shared `MarketplaceAddon`, `BusinessAddon`,
  `CatalogEntry`, `AddonPillar` (8 values incl. `cross`), labels +
  `formatMyr`.
- `lib/marketplace/load.ts` — server-side catalog loader (joins catalog
  with current business activation state).
- API routes `GET /api/marketplace`, `POST /api/marketplace/activate`,
  `POST /api/marketplace/deactivate`.
- `components/marketplace/MarketplaceView.tsx` — client view with
  featured banner, tab filters, search, sort, activate/deactivate flow,
  toast, confirm modal.
- `app/(app)/marketplace/page.tsx` server-renders the catalog and passes
  it down.
- Pencil: new screen **Screen — Marketplace** in `pencil-new.pen`.

---

## 2026-06-14 · Demo figures helper (no more "sample" placeholders)

**Goal:** every dashboard pillar tile, channel-mix chart, top-post
panel, and recent-activity row needs numbers — but the underlying
ledgers (Finance/Operations/Sales/HR/content engagement) don't ship
until later. We need numbers that look like a Malaysian SME doing
~RM 40–80k/month and stay consistent per tenant.

**Changes**

- New module [`lib/demo/figures.ts`](../lib/demo/figures.ts):
  - FNV-1a 32-bit hash → `pick`, `pickInt` deterministic from
    `(businessId, key)`.
  - `getDemoFigures(businessId)` — headline revenue, AR outstanding,
    low-stock, 7-day cashflow series, all pillar tile metrics.
  - `getDemoChannelMix(businessId)` — TikTok / IG / FB / WhatsApp reach
    + engagement %.
  - `getDemoTopPosts(businessId, limit)` — array of post cards (channel,
    title, views, likes, comments, shares).
  - `getDemoActivity(businessId, count)` — invoice-paid / POS sale /
    low-stock rows with realistic counterparts (Lapan Holdings, Aiman
    Trading, Studio Kreatif, …) and SKUs.
- Wired into:
  - Home dashboard pillar tiles + 7-day cashflow chart + Recent activity
    (`app/(app)/home/page.tsx`).
  - Marketing overview channel performance + top posts
    (`app/(app)/marketing/page.tsx`).
- Receipt preview on
  [`components/settings/BrandingForm.tsx`](../components/settings/BrandingForm.tsx)
  now derives a live receipt number, date, and time at mount (kept in a
  `useEffect` to avoid an SSR hydration mismatch).

**When pillar ledgers ship later**, the per-pillar dashboards should
swap `getDemoFigures(...)` for their own server queries. The helper is
intentionally isolated so search-replace is the only refactor required.

---

## 2026-06-14 · Settings hub redesign (subscription, billing, security,
branding wired live)

**Goal:** make the four account-settings pages fully working with
backend synchronization.

**Changes**

- Subscription
  ([`components/settings/SubscriptionView.tsx`](../components/settings/SubscriptionView.tsx)):
  immediate tier switch via `settings_change_tier` RPC, usage tiles for
  seats/customers/credits, confirmation modal.
- Billing
  ([`components/settings/BillingView.tsx`](../components/settings/BillingView.tsx)
  + `/api/settings/billing/*`): manage payment methods (Billplz /
  Curlec / Stripe / manual stubs), top up Fast Credits via
  `settings_topup_credits` RPC, view invoices.
- Security
  ([`components/settings/SecurityView.tsx`](../components/settings/SecurityView.tsx)
  + `/api/settings/security/*`): change password (re-auth required),
  TOTP-based 2FA enrol + verify, active sessions list, audit log.
- Branding
  ([`components/settings/BrandingForm.tsx`](../components/settings/BrandingForm.tsx)
  + `/api/settings/branding`): logo upload to Supabase Storage, primary
  + accent colour swatches with custom hex, receipt header fields,
  email-identity fields, live receipt preview.

All four pages enforce `user.role === 'owner'` at both the API layer
and via the `canEdit` prop on the view components.

---

## Where to look next

| If you're touching… | Read first |
|---|---|
| A new pillar page | [`architecture/entitlements.md`](./architecture/entitlements.md) |
| A new pillar API route | [`architecture/auth-claims.md`](./architecture/auth-claims.md) |
| Marketplace catalog data | [`marketplace-addons.md`](./marketplace-addons.md) and migration 11 |
| Tier / plan copy or pricing | [`lib/settings/plans.ts`](../lib/settings/plans.ts) |
| Anything that needs realistic demo numbers | [`lib/demo/figures.ts`](../lib/demo/figures.ts) |
