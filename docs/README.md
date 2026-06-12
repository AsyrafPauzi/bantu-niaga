# Bantu Niaga — Engineering Playbook

> Single source of truth for what we're building and how. Investor / sales material lives elsewhere; this folder is dev-only.

Bantu Niaga is a **unified AI Business Operating System** for Malaysian micro-SMEs and sole proprietors operating under **Enterprise** status — **one product, one account, one database** that adapts to context: 🖥️ desktop-grade control and analytics when the owner sits down to manage, 📱 mobile-grade execution when the cashier rings up a sale or the owner snaps a receipt on the move.

Under the hood: a single Next.js codebase, one PostgreSQL backbone (Supabase), one role-based access layer (6 roles), one event bus, and one AI orchestrator. The product maps day-to-day operations into **6 Core Pillars**.

See [`architecture/dual-mode.md`](./architecture/dual-mode.md) for the dual-mode architecture and [`v1-core-scope.md`](./v1-core-scope.md) for what's actually shipping in v1.

---

## 1. The Six Pillars

| # | Pillar | Purpose | One-liner |
|---|--------|---------|-----------|
| 1 | [Admin](./pillars/01-admin.md) | Back-office hygiene | Storage, tasks, templates, notifications |
| 2 | [Finance](./pillars/02-finance.md) | Money in/out + compliance | Ledger, invoices, LHDN-ready exports |
| 3 | [Operations](./pillars/03-operations.md) | Production & delivery | Pipeline, suppliers, products, bookings |
| 4 | [Marketing](./pillars/04-marketing.md) | Reach & retain | CRM, content calendar, promos |
| 5 | [Sales](./pillars/05-sales.md) | Close deals + take payment | Lead CRM, mobile POS |
| 6 | [HR](./pillars/06-hr.md) | People & shifts | Registry, leave, rota |

Each pillar doc follows the same shape: Goal · Base Features · Marketplace Add-ons · Data Model · User Flows · Open Questions.

---

## 2. v1 Scope and Boundaries

- **Locked v1 core scope:** [`v1-core-scope.md`](./v1-core-scope.md) — the canonical list of what ships in v1 across all 6 pillars. Plans cite this; if you're tempted to build something not in it, stop and re-read.
- **Add-on catalog:** [`marketplace-addons.md`](./marketplace-addons.md) — what's intentionally deferred to paid add-ons. Use this to know where a "nice idea" actually belongs in the roadmap.

---

## 3. Cross-Pillar Behavior

Pillars are not silos — they share a unified relational database and react to each other's events. Examples:

- **Sales → Finance + Operations:** completing a POS sale creates an invoice + payment in Finance and decrements stock in Operations.
- **HR → Operations:** approving a leave application blocks bookings against that staff member.
- **Marketing → Sales:** customer leads captured on marketing landing pages pipe directly into the Sales pipeline.

Full event map and contract → [`architecture/cross-pillar-sync.md`](./architecture/cross-pillar-sync.md).

---

## 4. AI Layer

AI is a separate, opt-in layer. Per-Pillar Agents deliver structured triggers (no open chat). When 2+ Agents are active, the multi-agent **Executive Boardroom** unlocks for cross-pillar reasoning.

Spec: [`ai/agents.md`](./ai/agents.md) · [`ai/executive-boardroom.md`](./ai/executive-boardroom.md).

---

## 5. Design Principles

These apply to every pillar and every feature. If a spec violates one, it needs justification.

1. **Execution first.** Mobile completes general actions in **< 10s**; hot paths (POS, mark-paid, task tick) in **< 5s**.
2. **Control second.** Desktop is for analytics, configuration, reporting — never for dozens-per-day actions.
3. **Mobile-first, thumb-friendly.** Primary device = a smartphone held one-handed behind a counter. Bottom-nav in TikTok / Shopee style.
4. **Lock the boilerplate, free the variables.** Templates expose fill-in fields; structural layout stays protected unless the user pays for the Custom Document Builder.
5. **Secure-by-default sharing.** Every public URL uses a non-guessable random hash.
6. **WhatsApp is a first-class channel.** Outputs are built to be copy-pasted or linked directly into WA.
7. **Malaysia-native.** LHDN e-invoicing, DuitNow QR, IC numbers, AL/EL/MC codes, BM-friendly copy.
8. **Structured AI, not open chat.** AI never sees a free-text terminal; it ingests structured pillar events and emits structured outputs.
9. **Throttle, don't block.** Resource exhaustion (credits, storage) downgrades quality of service, never disables operational workflows.
10. **RBAC defense in depth.** Every role × pillar × action combination is guarded at API + UI + DB layers.

---

## 6. Naming & URL Conventions

- **Business identifier:** `[idcompany]` — short, slugified, immutable once set.
- **Invoice URL:** `bantuniaga.com/[idcompany]/inv-[secure-random-hash]` (e.g. `inv-9k2p4x8w`).
- **Leave form URL:** `bantuniaga.com/[idcompany]/leave-[secure-random-hash]`.
- Hash spec: 8 chars, lowercase alphanumeric, cryptographically random.

Full term list → [`glossary.md`](./glossary.md).

---

## 7. Tech Stack — LOCKED

| Layer | Choice |
|-------|--------|
| Hosting | **Vercel (Singapore edge)** |
| Frontend | Next.js 15 + Tailwind CSS — single codebase serves Desktop ERP + Mobile PWA |
| Backend | **Next.js Route Handlers + Supabase Edge Functions** (no separate Express service) |
| DB + Auth + Storage + Realtime | **Supabase (Singapore)** — Postgres with RLS, Auth, S3-compatible Storage |
| AI | OpenAI GPT-4o-mini with strict JSON Schema constraints |
| Payments | Billplz (primary) / Curlec (fallback) |
| Email | Supabase Auth + Resend |

Full stack details + non-functional requirements → [`architecture/tech-stack.md`](./architecture/tech-stack.md).

---

## 8. How to Use This Playbook

- **Before implementing anything:** read [`PRD.md`](./PRD.md) + the relevant pillar doc + [`architecture/cross-pillar-sync.md`](./architecture/cross-pillar-sync.md) + [`architecture/tech-stack.md`](./architecture/tech-stack.md) + [`glossary.md`](./glossary.md).
- **Before starting a pillar build:** read its implementation plan in [`plans/`](./plans/) and the locked-decisions doc (if one exists).
- **Working on AI features:** [`ai/agents.md`](./ai/agents.md) and [`ai/executive-boardroom.md`](./ai/executive-boardroom.md) are mandatory reading.
- **Designing UI:** pillar docs have user flows; pair with the design principles above and [`architecture/dual-mode.md`](./architecture/dual-mode.md).

---

## 9. Document Map

```
docs/
├── README.md                          # this file — start here
├── PRD.md                             # full product requirements
├── v1-core-scope.md                   # locked v1 feature list per pillar
├── glossary.md                        # terms, URL conventions, RBAC roles
├── marketplace-addons.md              # add-on catalog (deferred-to-paid features)
├── pillars/
│   ├── 01-admin.md
│   ├── 02-finance.md
│   ├── 03-operations.md
│   ├── 04-marketing.md
│   ├── 05-sales.md
│   └── 06-hr.md
├── architecture/
│   ├── dual-mode.md                   # Desktop ERP vs Mobile PWA split + role × mode matrix
│   ├── cross-pillar-sync.md           # event bus contract between pillars
│   ├── auth-claims.md                 # JWT claims for RBAC
│   └── tech-stack.md                  # frontend / backend / DB / AI / RBAC
├── plans/
│   ├── marketing-implementation-plan.md
│   ├── marketing-decisions.md         # 12 locked decisions for Marketing v1
│   ├── sales-implementation-plan.md
│   └── hr-implementation-plan.md
└── ai/
    ├── agents.md                      # per-pillar agents, tokens, slow mode
    └── executive-boardroom.md         # multi-agent orchestrator
```
