# Bantu Niaga — Engineering Playbook

> Source of truth for the current product, module scope, add-ons, and engineering direction.

Bantu Niaga is a Malaysia-native business operating system for **solo entrepreneurs, micro SMEs, and growing SMEs**. It should feel simple enough for a phone-first owner, but serious enough for a real business with staff, customers, documents, invoices, sales, and compliance needs.

The product has six modules. Core module features cover the daily workflow. Add-ons carry premium automation, analytics, integrations, approvals, AI, and scale.

---

## 1. Source of Truth

Read these first:

- [`PRD.md`](./PRD.md) — product positioning, target market, and principles.
- [`target-market.md`](./target-market.md) — target customer groups, plan fit, and business examples.
- [`pricing-plan.md`](./pricing-plan.md) — Free/Starter/Growth/Pro packaging, add-on pricing guidance, discounts, and trials.
- [`v1-core-scope.md`](./v1-core-scope.md) — core features for all six modules.
- [`marketplace-addons.md`](./marketplace-addons.md) — premium add-on catalog.
- [`pillars/`](./pillars/) — detailed module specs.
- [`architecture/`](./architecture/) — technical architecture.
- [`ai/`](./ai/) — AI agents and Boardroom.

Older founder narratives and broad planning drafts are archived under `docs/archive/` and should not override the files above.

---

## 2. The Six Modules

| # | Module | Purpose | One-liner |
| --- | --- | --- | --- |
| 1 | [Admin](./pillars/01-admin.md) | Business control centre | Documents, tasks, reminders, templates |
| 2 | [Finance](./pillars/02-finance.md) | Money visibility | Income, expenses, invoices, payment tracking |
| 3 | [Operations](./pillars/03-operations.md) | Work delivery | Products, suppliers, orders, bookings |
| 4 | [Sales](./pillars/05-sales.md) | Selling and checkout | Leads, follow-ups, mobile POS |
| 5 | [HR](./pillars/06-hr.md) | People records | Staff profiles, leave, onboarding |
| 6 | [Marketing](./pillars/04-marketing.md) | Customer retention | CRM, segments, content, coupons |

Each module doc follows the same shape: Purpose, Target Users, Core Features, Add-on Features, User Flows, and Data Notes.

---

## 3. Packaging Rule

Core features should help owners complete the daily workflow:

- Record.
- Organize.
- Share.
- Track.

Add-on features should create premium growth value:

- Automate.
- Analyze.
- Integrate.
- Approve.
- Predict.
- Scale.
- Add AI assistance.

This prevents the core product from feeling cheap while still protecting future upsell paths.

---

## 4. Cross-Module Behavior

Modules are connected through one tenant-scoped database and cross-module events. Examples:

- Sales records revenue that Finance can summarize.
- Marketing customer records can be used by Sales, Finance, and Operations.
- Operations products can appear in Sales POS.
- HR roles affect access to Admin, Sales, Finance, and other modules.
- Inventory automation, customer booking pages, and AI insights should only run when the relevant add-on is active.

Full event map: [`architecture/cross-pillar-sync.md`](./architecture/cross-pillar-sync.md).

---

## 5. AI Layer

AI is a separate, opt-in premium layer. It should not be required for the core workflows to function.

- One AI agent can exist per module.
- AI actions should be structured, credit-aware, and tenant-scoped.
- Executive Boardroom unlocks when multiple AI agents are active.

Specs:

- [`ai/agents.md`](./ai/agents.md)
- [`ai/executive-boardroom.md`](./ai/executive-boardroom.md)

---

## 6. Design Principles

1. **Simple first.** A solo entrepreneur should understand the feature without training.
2. **Premium through usefulness.** The product should look advanced through clean dashboards, secure sharing, reminders, automation, and insight, not by adding ERP complexity.
3. **Mobile execution, desktop control.** Daily actions should work well on phone; review, setup, reports, and administration can be stronger on desktop.
4. **WhatsApp-native.** Sharing, reminders, customer messages, and owner workflows should respect how Malaysian SMEs already operate.
5. **Malaysia-native.** Support local realities such as DuitNow, SSM, SST, LHDN, IC/passport records, AL/EL/MC, and BM/EN copy.
6. **Secure by default.** Public links must be non-guessable. Sensitive records need tenant scoping, role checks, private storage, and no raw database errors in user-facing responses.
7. **Add-ons must not fix broken core.** A core module must complete its daily job without paid add-ons.

---

## 7. Document Map

```text
docs/
├── README.md
├── PRD.md
├── target-market.md
├── pricing-plan.md
├── v1-core-scope.md
├── marketplace-addons.md
├── glossary.md
├── pillars/
│   ├── 01-admin.md
│   ├── 02-finance.md
│   ├── 03-operations.md
│   ├── 04-marketing.md
│   ├── 05-sales.md
│   └── 06-hr.md
├── architecture/
│   ├── dual-mode.md
│   ├── cross-pillar-sync.md
│   ├── auth-claims.md
│   ├── entitlements.md
│   ├── integrations.md
│   ├── social-integrations.md
│   ├── ai-context-isolation.md
│   ├── pdpa.md
│   ├── super-admin.md
│   └── tech-stack.md
├── ai/
│   ├── agents.md
│   └── executive-boardroom.md
├── plans/
└── archive/
```

---

## 8. Implementation Reading Order

Before building or changing a module:

1. Read `docs/PRD.md`.
2. Read `docs/v1-core-scope.md`.
3. Read `docs/marketplace-addons.md`.
4. Read the relevant file in `docs/pillars/`.
5. Read the relevant architecture docs.
6. Check `docs/CHANGELOG.md` for shipped behavior before changing code.
