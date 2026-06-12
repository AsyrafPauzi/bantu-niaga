# Bantu Niaga (SME-OS) — Product Playbook

> Internal codename: **SME-OS**. Consumer brand: **Bantu Niaga**. The single source of truth for what we're building, who it serves, and how it's packaged, priced, and reasoned about.

Bantu Niaga is a **unified AI Business Operating System** for Malaysian micro-SMEs and sole proprietors operating under **Enterprise** status — **one product, one account, one database** that adapts to context: 🖥️ desktop-grade control and analytics when the owner sits down to manage, 📱 mobile-grade execution when the cashier rings up a sale or the owner snaps a receipt on the move.

Under the hood it's a single Next.js codebase, one PostgreSQL backbone, one role-based access layer (6 roles), one event bus, and one AI orchestrator. The product maps day-to-day operations into **6 Core Pillars** under a **"Golden Middle"** philosophy — high workflow value without data-entry fatigue.

Two flywheels drive monetization:

1. A **Plug-and-Play Module Marketplace** of à-la-carte feature add-ons.
2. An **abuse-proof Multi-Agent AI Executive Boardroom** that lets a solo owner consult a virtual exec team.

See [executive-summary.md](./executive-summary.md) for the problem/solution framing and [architecture/dual-mode.md](./architecture/dual-mode.md) for the dual-mode architecture.

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

## 2. Packaging Model

BantuNiaga ships as **three tiered base packages** with a **shared add-on marketplace** layered on top.

| Tier | Price | Pillars Active | Core User Limit | Target |
|------|------:|----------------|-----------------|--------|
| **Starter** | RM 50/mo | Admin · Finance · Operations | 1 (owner only) | Solo founders, home-bakers, dropshippers |
| **Micro** | RM 80/mo | Adds Marketing + HR | Up to 3 staff | Retail stalls, boutique kiosks, small workshops |
| **SME** | RM 120/mo | All 6 (unlocks Sales) | Up to 10 staff | Established businesses scaling teams |

On top of any tier:

- **Marketplace Add-ons** — discrete monthly upgrades per pillar. See [marketplace-addons.md](./marketplace-addons.md).
- **AI Agents** — RM15–20/mo per pillar; bring proactive insights and unlock the Executive Boardroom when 2+ are active. See [ai/agents.md](./ai/agents.md).

Full price matrix + worked examples → [pricing.md](./pricing.md).
Tier-by-tier inclusion detail → [packaging.md](./packaging.md).

---

## 3. Cross-Pillar Behavior

Pillars are not silos — they share a unified relational database and react to each other's events. Key examples:

- **Sales → Finance + Operations:** marking an invoice **Paid** logs cash income in Finance and decrements stock in Operations.
- **HR → Finance:** approving monthly payroll auto-creates a cash outflow under the "Staff Remuneration" LHDN tax category.
- **Marketing → Sales:** customer leads captured on marketing landing pages pipe directly into the Sales pipeline.

Full event map → [architecture/cross-pillar-sync.md](./architecture/cross-pillar-sync.md).

---

## 4. AI Layer

AI is a separate, opt-in layer — not part of the base tier.

- **Per-Pillar Agents** (RM15–20/mo) deliver a daily 3-point briefing on the Proactive Morning Dashboard and respond to **structured triggers** (no open chat boxes).
- **Token Economy:** each Agent adds 100 fast credits/month. Out-of-credit users are throttled into **Slow Mode** (15–20s responses), never blocked. Top-ups: RM10 / 50 fast credits.
- **Executive Boardroom:** when 2+ Agents are active, an orchestrator runs multi-agent cross-examination on a single user prompt — at a flat **1 credit per turn**.

Details: [ai/agents.md](./ai/agents.md) · [ai/executive-boardroom.md](./ai/executive-boardroom.md).

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
- Full term list → [glossary.md](./glossary.md).

---

## 7. Technical Infrastructure (Summary) — Stack LOCKED

| Layer | Choice |
|-------|--------|
| Hosting | **Vercel (Singapore edge)** |
| Frontend | Next.js + Tailwind CSS — **single codebase serves Desktop ERP + Mobile PWA** |
| Backend | **Next.js Route Handlers + Supabase Edge Functions** (no separate Express service) |
| DB + Auth + Storage + Realtime | **Supabase (Singapore)** — Postgres with RLS, Auth, S3-compatible Storage |
| AI | OpenAI GPT-4o-mini with strict JSON Schema constraints |
| Payments | Billplz (primary) / Curlec (fallback) |
| Email | Supabase Auth + Resend |
| **Fixed infra cost (MVP)** | **~RM 10 / month** — free tiers cover first 100 paying customers |
| **Fixed infra cost (Growth, 100–1K users)** | **~RM 220 / month** |
| **Variable cost** | **~RM 0.26 / active user / month** |
| **Gross margin** | **99%+ from day one** |

Full stack details + non-functional requirements + stage-based cost model → [architecture/tech-stack.md](./architecture/tech-stack.md).

---

## 8. How to Use This Playbook

- **Founders / PMs:** start here → [executive summary](./executive-summary.md) → [packaging](./packaging.md) → [pricing](./pricing.md).
- **Engineers:** read [PRD.md](./PRD.md) + the relevant pillar doc + [cross-pillar-sync](./architecture/cross-pillar-sync.md) + [tech-stack](./architecture/tech-stack.md) + [glossary](./glossary.md) before implementing.
- **AI engineers:** [ai/agents.md](./ai/agents.md) and [ai/executive-boardroom.md](./ai/executive-boardroom.md) are mandatory reading.
- **Designers:** pillar docs have user flows; pair with the design principles above.
- **Sales / Support:** [packaging.md](./packaging.md), [pricing.md](./pricing.md), and [marketplace-addons.md](./marketplace-addons.md).
- **Investors / Partners:** [pitch-deck.md](./pitch-deck.md) is the 15-slide deck; [business-proposal.md](./business-proposal.md) is the due-diligence companion; [executive-summary.md](./executive-summary.md) is the elevator pitch.

---

## 9. Status

This playbook is **v0.5** — stack locked (Vercel + Supabase), full 6-role RBAC built in Phase 0 via permissions matrix, roadmap optimized (first paying customer at Week 12).

| Area | Status |
|------|--------|
| Pillar feature list | Captured (v1) |
| Add-on catalog | Captured (v1) |
| Tier packaging | Captured (Starter / Micro / SME) |
| Dual-mode architecture | Captured (Desktop ERP + Mobile PWA, shared backbone) |
| User roles (RBAC) | **LOCKED — 6 roles in v1, built once in Phase 0 via permissions matrix + Supabase RLS** |
| Cross-pillar sync events | High-level map captured |
| AI agent economy | Captured (credits, slow mode, top-ups) |
| Executive Boardroom | Captured (orchestrator + 1-credit/turn) |
| Tech stack | **LOCKED — Vercel + Supabase + OpenAI + Billplz** |
| Infrastructure cost model | **LOCKED — RM 10/mo MVP, RM 220/mo Growth, 99%+ margin** |
| MVP roadmap | **LOCKED — 6 phases, first paying customer Week 12, full vision Week 44** |
| **PRD** | **v0.5 — stack + RBAC + roadmap all locked** |
| **Business & Investor Proposal** | **v0.4 — stack locked, 99% margin story, Week 12 first revenue** |
| **Investor Pitch Deck** | **v0.1 — 15 slides, ready for pre-seed conversations** |
| Data models | Sketches only — needs review |
| Detailed UX flows | High-level — needs design pass |
| Financial model | **Illustrative only** — needs primary research + cohort modeling |

---

## 10. Document Map

```
docs/
├── README.md                          # this file — start here
├── PRD.md                             # FLAGSHIP: full product requirements (engineering kickoff)
├── business-proposal.md               # FLAGSHIP: investor / partner proposal (due-diligence read)
├── pitch-deck.md                      # FLAGSHIP: 15-slide investor pitch deck
├── executive-summary.md               # problem, solution, target user
├── packaging.md                       # Starter / Micro / SME tier detail
├── pricing.md                         # full price matrix + worked examples
├── marketplace-addons.md              # full add-on catalog
├── glossary.md                        # terms, URL conventions, vocab, RBAC roles
├── pillars/
│   ├── 01-admin.md
│   ├── 02-finance.md
│   ├── 03-operations.md
│   ├── 04-marketing.md
│   ├── 05-sales.md
│   └── 06-hr.md
├── architecture/
│   ├── dual-mode.md                   # Desktop ERP vs Mobile PWA split + role × mode matrix
│   ├── cross-pillar-sync.md           # event flow between pillars
│   └── tech-stack.md                  # frontend / backend / DB / AI / RBAC / infra cost
├── plans/
│   └── marketing-implementation-plan.md   # Marketing pillar build plan (data model, events, milestones)
└── ai/
    ├── agents.md                      # per-pillar agents, tokens, slow mode
    └── executive-boardroom.md         # multi-agent orchestrator
```
