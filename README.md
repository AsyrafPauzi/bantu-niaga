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
```

Open http://localhost:3000 — the app auto-renders the **mobile** shell on phones / narrow viewports and the **desktop ERP** shell on wide viewports.

## Repo layout

```
app/
├── (app)/                  # Authenticated app routes (mode-adaptive shell)
│   ├── admin/              # Pillar 1
│   ├── finance/            # Pillar 2
│   ├── operations/         # Pillar 3
│   ├── marketing/          # Pillar 4
│   ├── sales/              # Pillar 5
│   ├── hr/                 # Pillar 6
│   ├── boardroom/          # AI Executive Boardroom (desktop primary)
│   ├── marketplace/        # Add-on activation
│   └── settings/           # Team, billing
├── (public)/               # Unauthenticated secure-hash URLs
│   └── [idcompany]/
│       ├── inv-[hash]/     # Invoice URL
│       ├── book-[hash]/    # Customer-facing booking page
│       └── leave-[hash]/   # Self-service leave form (HR add-on)
├── api/                    # Next.js Route Handlers (thin CRUD)
└── globals.css

components/
├── ui/                     # Primitives (button, card, badge, ...)
├── shells/                 # MobileShell + DesktopShell (mode-adaptive)
└── pillars/{pillar}/       # Pillar-specific feature components

lib/
├── permissions.ts          # The single 6-role × 6-pillar RBAC matrix
├── supabase/               # Browser + server clients
├── pillars/{pillar}/       # Domain logic per pillar
├── events/                 # Cross-pillar event bus types
├── schemas/                # Zod schemas (shared with API + AI strict JSON)
└── ai/                     # OpenAI client + Boardroom orchestrator (Phase 4)

supabase/
├── migrations/             # SQL: tables, RLS policies, triggers
├── functions/              # Edge Functions: long-running jobs, event dispatcher
└── config.toml
```

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/v1-core-scope.md`](docs/v1-core-scope.md) | Finalized v1 Base Package across all 6 pillars |
| [`docs/pillars/0X-*.md`](docs/pillars/) | Per-pillar specs |
| [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) | Stack decisions |
| [`docs/architecture/dual-mode.md`](docs/architecture/dual-mode.md) | Desktop ERP + Mobile PWA architecture |
| [`docs/architecture/cross-pillar-sync.md`](docs/architecture/cross-pillar-sync.md) | Event bus design |
| [`docs/marketplace-addons.md`](docs/marketplace-addons.md) | Add-on catalog (deferred until v1 core ships) |
| [`docs/pricing.md`](docs/pricing.md), [`docs/packaging.md`](docs/packaging.md) | Tiers + add-on pricing |

## Design tokens

UI direction: SME-friendly, not corporate, no gradients. See `tailwind.config.ts` for the full palette. The brand and accent colors are sampled directly from the Bantu Niaga logo: primary is **royal blue** (`brand-500: #1D4ED8`, the "Bantu" wordmark and bag-and-B mark), CTA is **vibrant orange** (`accent-500: #F97316`, the "Niaga" wordmark and awning stripes), and the background stays **warm cream** (`cream-100: #FAF7F2`) with warm ink neutrals so the UI keeps its SME warmth instead of feeling cold-corporate. Status `success` is intentionally retained as a separate green so confirmations stay semantically distinct from primary actions.
