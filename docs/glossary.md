# Glossary & Conventions

> Vocabulary, URL patterns, and naming conventions used across the BantuNiaga (SME-OS) playbook.

## Product Terms

| Term | Meaning |
|------|---------|
| **Bantu Niaga** | Consumer brand. |
| **SME-OS** | Internal project codename. Same product as Bantu Niaga. |
| **Dual-Mode** | The two-interface product architecture: Desktop ERP (control) + Mobile PWA (execution), sharing one backbone. See [architecture/dual-mode.md](./architecture/dual-mode.md). |
| **Desktop ERP** | The control & analytics interface. Used for deep management, reporting, configuration, and the AI Boardroom Console. |
| **Mobile PWA** | The execution engine. Installable Progressive Web App optimized for sub-10-second on-the-go actions. |
| **Pillar** | One of the six functional areas of the product: Admin, Finance, Operations, Marketing, Sales, HR. |
| **Base Package** | The always-included feature set within a single pillar. |
| **Tier** | One of the three base packages: **Starter (RM50)**, **Micro (RM80)**, **SME (RM120)**. Determines which pillars are active and how many staff seats are allowed. |
| **Active Pillar** | A pillar enabled in the user's current tier. Only active pillars surface UI, accept events, and allow add-on / AI Agent purchases. |
| **Locked Pillar** | A pillar gated behind a higher tier. Data is buffered (not deleted) until the user upgrades. |
| **Marketplace Add-on** | An optional, separately-billed feature pack that an owner enables for an active pillar. |
| **Storage Tier** | A special add-on category. Mutually exclusive — one tier active at a time. |
| **AI Agent** | A per-pillar premium intelligence layer (RM15–20/mo). Adds 100 Fast Credits to the pool when subscribed. |
| **Executive Boardroom** | Multi-agent orchestrated interface that activates when ≥ 2 AI Agents are subscribed. Desktop ERP is the primary surface. |
| **Golden Middle** | The product philosophy — enough workflow value to replace fragmented tools, without the data-entry fatigue of a full ERP. |
| **Business / Tenant** | A single customer account. Identified by `idcompany`. |
| **Hot path** | An action that must be optimized for the **5-second rule** (POS sale, mark-paid, task tick). |
| **Mobile execution rule** | All non-hot-path mobile actions must complete in **< 10 seconds**. |

## User Roles (RBAC)

| Role | Access | Primary Mode |
|------|--------|--------------|
| **Owner** | Full system (incl. billing, role assignment) | Both |
| **Manager** | Operational control across active pillars; no billing/role assignment | Both |
| **Accountant** | Finance module only | Desktop |
| **HR Officer** | HR module only + Admin storage for HR docs | Both |
| **Cashier** | POS surface only | Mobile |
| **Staff** | Assigned task board + Self-Service Leave only | Mobile |

Defense in depth: RBAC enforced at **API middleware + UI shell + Postgres RLS**. Each role × pillar × action combination is unit-tested.

## AI & Token Economy Terms

| Term | Meaning |
|------|---------|
| **Structured Trigger** | Any AI invocation initiated by a fixed prompt template + JSON Schema output. No open chat boxes. |
| **Proactive Morning Dashboard** | The daily 3-item briefing rendered by each subscribed AI Agent at the start of the business day. |
| **Fast Credit** | A unit of AI execution budget. 1 credit ≈ 1 daily summary or 1 Boardroom turn. 100 bundled per Agent per month. |
| **Fast Mode** | Normal AI response speed (< 2s). Active while the credit pool > 0. |
| **Slow Mode** | Throttled AI response (15–20s deliberate delay). Active when the credit pool is exhausted. **Never blocks workflow.** |
| **Top-Up Pack** | RM10 for 50 additional Fast Credits. Restores Fast Mode immediately. |
| **Relevance Safeguard Filter** | The Boardroom orchestrator step that silences irrelevant Agents for a given prompt — saves credits and tokens. |
| **Boardroom Turn** | One Agent's contribution to a Boardroom run. Flat cost: 1 credit per turn. |

## Architecture Terms

| Term | Meaning |
|------|---------|
| **Cross-Pillar Sync** | The event-driven framework that propagates state mutations across pillars (see [architecture/cross-pillar-sync.md](./architecture/cross-pillar-sync.md)). |
| **Domain Event** | A typed message (e.g. `invoice.paid`, `payroll.approved`) emitted when an entity's state changes. |
| **Transactional Outbox** | The Postgres pattern used to make event publication atomic with the source DB transaction. |
| **Sync Handler** | A listener that runs inside the same transaction as the source event (must succeed or rollback). Used for ledger writes, stock decrements. |
| **Async Handler** | A queued listener (notifications, AI summaries, emails). Eventually consistent. |
| **business_id** | Internal UUID for a tenant. Every table includes it; every query is scoped by it. |
| **RLS** | Postgres Row-Level Security — enforces tenant isolation at the database layer. |
| **idcompany** | The user-facing slug identifying a business. Distinct from `business_id` (the internal UUID). |

## URL & Identifier Conventions

### Business Identifier — `idcompany`
- Short, slugified, lowercase, alphanumeric (+ hyphens).
- Immutable once chosen.
- Example: `intantrade`, `kedai-mama`, `homestay-ipoh`.

### Secure Share URLs
All publicly shareable resources (invoices, leave forms, downloadable docs) use the pattern:

```
bantuniaga.com/[idcompany]/[prefix]-[secure-random-hash]
```

| Resource | Prefix | Example |
|----------|--------|---------|
| Invoice | `inv` | `bantuniaga.com/intantrade/inv-9k2p4x8w` |
| Leave self-service form | `leave` | `bantuniaga.com/intantrade/leave-7m3q2v1b` |
| Document (generated PDF) | `doc` | `bantuniaga.com/intantrade/doc-a4c9k2p1` _(proposed)_ |
| File share (Storage) | `f` | `bantuniaga.com/intantrade/f-x7q2m9k4` _(proposed)_ |
| UTM short link _(add-on)_ | `r` | `bantuniaga.com/r/9k2p4x8w` _(proposed; no idcompany to keep links short)_ |

### Hash Spec
- 8 characters, lowercase alphanumeric (`[a-z0-9]`).
- Cryptographically random (not sequential, not predictable from creation time).
- Unique per resource type within an `idcompany`.
- Collision strategy: regenerate on conflict.

## Status Vocabularies

These are the canonical state names used across the system. Use these exact tokens in code, UI labels can be localized.

| Domain | States |
|--------|--------|
| Task | `TODO` · `DOING` · `DONE` |
| Invoice | `DRAFT` · `SENT` · `PAID` · `VOID` |
| Order | `NEW` · `IN_PROGRESS` · `READY` · `DELIVERED` |
| Booking | `AVAILABLE` · `HELD` · `CONFIRMED` · `COMPLETED` · `CANCELLED` |
| Lead | `NEW` · `CONTACTED` · `NEGOTIATING` · `WON` · `LOST` |
| Content plan | `IDEA` · `DRAFTED` · `SCHEDULED` · `POSTED` |
| Leave | `PENDING` · `APPROVED` · `REJECTED` |
| Leave type | `AL` (Annual) · `EL` (Emergency) · `MC` (Medical Certificate) |
| Payment method (POS) | `CASH` · `DUITNOW_QR` |
| Transaction type | `REVENUE` · `EXPENSE` |
| AI Agent | `ADMIN` · `FINANCE` · `OPERATIONS` · `MARKETING` · `HR` · `SALES` · `BOARDROOM` |
| AI trigger type | `SUMMARY` · `CONTEXT_TEXT` · `AGGREGATION` · `BOARDROOM_TURN` |
| AI mode | `FAST` · `SLOW` |
| Boardroom stance | `SUPPORT` · `NEUTRAL` · `WARNING` |

## Malaysia-Specific Terms

| Term | Meaning |
|------|---------|
| **LHDN** | Lembaga Hasil Dalam Negeri — Malaysia's Inland Revenue Board. Owns the e-invoicing mandate. |
| **e-Invoicing** | LHDN's mandatory XML-based invoice reporting regime. |
| **Form B** | LHDN tax form for individuals with business income. |
| **Form P** | LHDN tax form for partnerships. |
| **DuitNow** | Malaysia's national real-time payment rails. |
| **DuitNow Static QR** | A QR code printed/displayed by a merchant; customer scans and enters amount manually. |
| **DuitNow Dynamic QR** | A QR code with the exact sale amount + reference baked in, generated per-transaction. In v1 core POS for owners using a personal DuitNow ID (no merchant account required). |
| **SST** | Sales and Service Tax. |
| **MyTax** | LHDN's online filing portal. |
| **IC** | Identity Card (MyKad). |
| **EPF / SOCSO / EIS / PCB** | Statutory deductions (out of scope at v1). |
| **AL / EL / MC** | Annual Leave / Emergency Leave / Medical Certificate. |

## Channel Terms

| Term | Meaning |
|------|---------|
| **WhatsApp (WA)** | Primary external comms channel for SMEs in Malaysia. First-class output target. |
| **TikTok / IG / FB** | Social channels covered by the Content Calendar (planning only at v1). |

## Tech Stack Terms

| Term | Meaning |
|------|---------|
| **PWA** | Progressive Web App. Installable from the browser; uses Service Worker + Web App Manifest; the form factor of the Mobile PWA mode. |
| **Service Worker** | Browser-resident script that caches the PWA app shell and enables offline / push behavior. |
| **Web Push** | Browser-native push notification system used to deliver AI briefings, low-stock alerts, leave requests to the Mobile PWA. |
| **RBAC** | Role-Based Access Control. The 6-role permission system (Owner / Manager / Accountant / HR Officer / Cashier / Staff). |
| **GPT-4o-mini** | OpenAI's small cost-efficient model — the only AI model used in v1, for both per-pillar Agents and the Boardroom. |
| **Strict JSON Schema** | OpenAI's `response_format` with `strict: true` — eliminates AI output parsing errors. |
| **Billplz** | Malaysian payment aggregator supporting FPX + Credit Card; used for subscription billing. |
| **Curlec** | Alternative Malaysian payment aggregator (Razer/Razorpay subsidiary); used for FPX + Credit Card subscriptions. |
| **FPX** | Financial Process Exchange — Malaysia's interbank online payment network. |
| **Multi-tenant** | Architecture where one database serves many businesses, isolated by `business_id` (+ Postgres RLS). |

## Document Conventions

- All monetary amounts: **MYR**, two decimal places.
- All timestamps: stored as UTC, displayed in **Asia/Kuala_Lumpur**.
- All dates without time: `YYYY-MM-DD`.
- Language: copy in BM-friendly English at v1; localization to BM proper TBD.

## Versioning of This Playbook

- This is **v0.3** — incorporates dual-mode architecture, 6-role RBAC, infrastructure cost model.
- When updating any pillar doc, also update the **Status** table in [README.md](./README.md).
- Treat sections labeled _"Open questions"_ as **TODO** for follow-up spec from the founder.
