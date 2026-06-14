# Bantu Niaga

The unified AI Business Operating System for Malaysian micro-SMEs.

> Single repo. One Next.js app on Vercel. One Supabase project. No separate backend service.

## Stack

| Layer | Choice |
|---|---|
| Hosting + frontend | Vercel (Singapore edge) |
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers + Supabase Edge Functions |
| DB / Auth / Storage / Realtime | Supabase (Singapore region) |
| AI | OpenAI GPT-4o-mini (strict JSON Schema, structured triggers) |
| Payments | Billplz / Curlec |

Decisions and reasoning live in `docs/architecture/tech-stack.md`.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. (Optional) Local Supabase via Docker
npx supabase start
npx supabase migration up

# 4. Run dev server
npm run dev

# 5. (Optional) Seed 5 demo tenants with customers + social-media posts
npm run seed:demo
# Logs sign-in emails + the shared demo password at the end.
```

Open http://localhost:3000 — the app auto-renders the **mobile** shell on phones / narrow viewports and the **desktop ERP** shell on wide viewports.

## Repo layout

```
app/
├── (super-admin)/          # Platform-admin app (`/super-admin/*`)
│   └── super-admin/        # Dark sidebar · cross-tenant operate + catalog + insights
├── (app)/                  # Authenticated app routes (mode-adaptive shell)
│   ├── layout.tsx          # Loads business tier → AdaptiveShell
│   ├── admin/              # Pillar 1 — layout.tsx calls requirePillar()
│   ├── finance/            # Pillar 2 — always unlocked
│   ├── operations/         # Pillar 3 — layout.tsx calls requirePillar()
│   ├── marketing/          # Pillar 4 — layout.tsx calls requirePillar()
│   ├── sales/              # Pillar 5 — layout.tsx calls requirePillar()
│   ├── hr/                 # Pillar 6 — layout.tsx calls requirePillar()
│   ├── boardroom/          # AI Executive Boardroom (desktop primary)
│   ├── marketplace/        # Add-on activation (catalog tabs: Admin · HR · Finance · Operations · Marketing · Sales · AI agents)
│   ├── more/               # Mobile-only "More" hub
│   └── settings/           # Subscription · billing · security · branding · team
├── (public)/               # Unauthenticated secure-hash URLs
│   └── [idcompany]/
│       ├── inv-[hash]/     # Invoice URL
│       ├── book-[hash]/    # Customer-facing booking page
│       └── leave-[hash]/   # Self-service leave form (HR add-on)
├── sign-in/                # Sign-in (auth/callback redirects here)
├── sign-up/                # Self-serve registration → /api/auth/sign-up
├── forgot-password/        # Email reset trigger → /api/auth/forgot-password
├── reset-password/         # Recovery-session password update
├── auth/callback/          # Supabase email-link code exchange
├── api/                    # Next.js Route Handlers (thin CRUD + RPC wrappers)
│   ├── auth/               # sign-up · forgot-password · reset-password
│   ├── marketplace/        # activate · deactivate · catalog
│   ├── marketing/          # CRM + content APIs
│   ├── settings/           # business · subscription · billing · security
│   ├── social/meta/        # Facebook + Instagram Business — connect · callback · disconnect · post · insights
│   ├── privacy/            # PDPA data-subject rights — export · delete · consents · requests
│   ├── cron/               # privacy-sweep (hourly hard-delete worker)
│   └── super-admin/        # impersonate · users · businesses · marketplace · agents · privacy queue
└── globals.css

components/
├── ui/                     # Primitives (button, card, badge, ...)
├── shells/                 # AdaptiveShell + MobileShell + DesktopShell (tier-aware)
├── super-admin/            # SuperAdminShell + KPI primitives + row actions + scope editor
├── auth/                   # AuthShell for sign-in/sign-up/forgot/reset
├── marketplace/            # MarketplaceView (catalog + filter chips)
├── settings/               # SubscriptionView · BillingView · SecurityView · BrandingForm
└── dashboard/              # KpiTile · PageHeader · SectionCard · TxRow · AiBanner

lib/
├── auth/
│   ├── current-user.ts            # getCurrentUser() — role + business_id resolver (impersonation-aware)
│   ├── entitlements.ts            # TIER_PILLARS matrix · hasPillar · minimumTierFor
│   ├── require-pillar.ts          # Server guard used by pillar layouts
│   ├── require-platform-admin.ts  # Server guard for /super-admin/**
│   ├── impersonation.ts           # bn_impersonate cookie primitives
│   └── schemas.ts                 # Zod for sign-up / forgot / reset
├── super-admin/            # Service-role loaders + DTOs for /super-admin/**
├── privacy/                # PDPA — types · schemas · consent catalog · DSR loaders · export builder
├── social/                 # Meta (Facebook + Instagram) Graph API client + loaders
├── demo/figures.ts         # Deterministic per-business demo numbers
├── marketplace/            # Types + server-side catalog loader
├── settings/               # plans.ts (tier catalog), business.ts (row loader), schemas.ts (Zod)
├── permissions.ts          # The single 6-role × 6-pillar RBAC matrix
├── supabase/               # Browser + server clients
├── pillars/{pillar}/       # Domain logic per pillar
├── events/                 # Cross-pillar event bus types
└── ai/                     # OpenAI client + Boardroom orchestrator (Phase 4)

supabase/
├── migrations/             # SQL: tables, RLS policies, triggers, RPCs
├── functions/              # Edge Functions: long-running jobs, event dispatcher
└── config.toml
```

## Documentation

> Start with the **`CHANGELOG`** if you're picking the project up
> mid-flight — it's the running log of what's been shipped to the running
> app, in reverse-chronological order, with file + migration links.

| Doc | What it covers |
|---|---|
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Running log of shipped UI + backend changes (read this first) |
| [`docs/v1-core-scope.md`](docs/v1-core-scope.md) | Finalized v1 Base Package across all 6 pillars |
| [`docs/pillars/0X-*.md`](docs/pillars/) | Per-pillar specs |
| [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) | Stack decisions |
| [`docs/architecture/dual-mode.md`](docs/architecture/dual-mode.md) | Desktop ERP + Mobile PWA architecture |
| [`docs/architecture/auth-claims.md`](docs/architecture/auth-claims.md) | `role` + `business_id` resolution at every layer |
| [`docs/architecture/entitlements.md`](docs/architecture/entitlements.md) | Tier → pillar gating (Free/Plus/Growth/Pro) |
| [`docs/architecture/super-admin.md`](docs/architecture/super-admin.md) | Platform-admin app — schema, auth, impersonation, AI scope versioning |
| [`docs/architecture/social-integrations.md`](docs/architecture/social-integrations.md) | Meta (Facebook + Instagram Business) — OAuth, publish, insights |
| [`docs/architecture/integrations.md`](docs/architecture/integrations.md) | Platform-wide API integrations registry (OpenAI, WhatsApp, Billplz, MyInvois …) |
| [`docs/architecture/ai-context-isolation.md`](docs/architecture/ai-context-isolation.md) | AI agent tenant isolation + per-pillar briefing packets |
| [`docs/architecture/pdpa.md`](docs/architecture/pdpa.md) | PDPA compliance — DSRs, consent, retention, deletion grace |
| [`docs/architecture/cross-pillar-sync.md`](docs/architecture/cross-pillar-sync.md) | Event bus design |
| [`docs/marketplace-addons.md`](docs/marketplace-addons.md) | Live Marketplace catalog + activation rules |
| [`docs/plans/`](docs/plans/) | Implementation plans for Marketing, Sales, HR + locked decisions |

## Design tokens

UI direction: SME-friendly, not corporate, no gradients. See `tailwind.config.ts` for the full palette. The brand and accent colors are sampled directly from the Bantu Niaga logo: primary is **royal blue** (`brand-500: #1D4ED8`, the "Bantu" wordmark and bag-and-B mark), CTA is **vibrant orange** (`accent-500: #F97316`, the "Niaga" wordmark and awning stripes), and the background stays **warm cream** (`cream-100: #FAF7F2`) with warm ink neutrals so the UI keeps its SME warmth instead of feeling cold-corporate. Status `success` is intentionally retained as a separate green so confirmations stay semantically distinct from primary actions.
