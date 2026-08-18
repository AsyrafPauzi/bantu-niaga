# Pricing Plan — Middle Ground (v2026-08)

> **Status:** Approved direction for implementation. Code still reflects the legacy model (`RM69 / RM139 / RM249`, module-gated tiers, RM20/agent add-ons). Ship this document before changing `lib/settings/plans.ts`, entitlements, marketplace, and credit grants.
>
> **Goal:** Credible but accessible pricing for Malaysian micro-SMEs. **Free is deliberately tight** so owners feel the upgrade pull. **Basic (RM39)** serves freelancers with three modules + three agents. **Solo+** unlocks the full platform + six AI agents; **AI credits** meter usage so heavy consumption stays profitable.

---

## 1. Strategy summary

| Principle | Decision |
|-----------|----------|
| **Free** | **Finance lite only** — enough to try invoicing, not enough to run a business. **200 MB** storage. |
| **Basic** | **Admin + Sales + Finance** — freelancer entry at **RM39**; **3 AI agents**, **ILMU Mini 3.3** only, **1 GB** storage. |
| **Solo+** | **All six core modules** on Solo / Micro / Small / Scale; scale by seats, customers, storage. **Email: unlimited** while plan revenue covers variable COGS. |
| **AI hook** | **Agents included by tier** — 3 on Basic, **6 on Solo+** — no per-agent monthly fee. |
| **AI economics** | **20 bundled credits per included agent per month**; **top-up** for more; **pause** at zero (no free unlimited inference). |
| **Add-ons** | Automation, integrations, extra scale — priced **low** so tenants can stack several. |
| **Add-on ceiling** | No single add-on above **50% of that tenant’s plan MRR** (e.g. **RM20** on Basic, **RM40** on Solo). |
| **Campaigns** | Super-admin **create client account** with optional **promo tier** (e.g. Solo **3 months free**). |

**Positioning:** *Free shows the invoice workflow. Basic runs a freelancer’s admin + sales + finance desk. Solo+ runs the full business — with AI helpers included, credits for real usage.*

---

## 2. Plan ladder (middle ground)

| Tier | Legacy (code) | Credible (research) | **This plan** |
|------|---------------|---------------------|---------------|
| Free | RM0 · Finance only | RM0 · lite + sales | **RM0 · Finance lite only · 200 MB** |
| Freelancer | — | — | **RM39 · Admin + Sales + Finance · 3 agents · 1 GB** |
| Entry paid | RM69 · 3 modules | RM89 · 6 modules | **RM79 · 6 modules + 6 AI agents** |
| Team paid | RM139 · 5 modules | RM199 · 6 modules | **RM169 · 6 modules + 6 AI agents** |
| Growth paid | RM249 · 6 modules | RM349 · 6 modules | **RM299 · 6 modules + 6 AI agents** |
| Optional top | — | RM499 | **RM429** (optional) |

**MSME Madani (year 1):** Micro annual **RM1,690** → ~**RM845** net → ~**RM71/mo** effective.

---

## 3. Customer-facing names

| Display name | `TierKey` (DB) | Monthly | Annual (2 months free) |
|--------------|----------------|---------|-------------------------|
| **Free** | `starter` | RM0 | — |
| **Basic** | `basic` | **RM39** | **RM390** |
| **Solo** | `micro` | **RM79** | **RM790** |
| **Micro** | `sme` | **RM169** | **RM1,690** |
| **Small** | `enterprise` | **RM299** | **RM2,990** |
| **Scale** (optional) | _future `scale`_ | **RM429** | **RM4,290** |

**Note:** `basic` is a **new** `TierKey` — add to `lib/settings/plans.ts`, entitlements, and subscription billing before launch.

Retire legacy labels **Starter / Growth / Pro** in UI when this ships.

---

## 4. Free — RM0/month (Finance lite only)

**For:** “I want to try invoicing” — not “I want to run my shop for free.”

### 4.1 Module access

| Module | Free |
|--------|------|
| **Finance lite** | **Yes** (online only — see §4.2) |
| Admin, Operations, Sales, HR, Marketing | **Locked** |
| Boardroom | **Locked** (requires paid agents) |
| Marketplace add-ons | **Cannot purchase** |

### 4.2 Finance lite — allowed vs blocked

| Capability | Free |
|------------|------|
| **Income records** | **Yes** — log income, see income on dashboard |
| **Expense records** | **No** — UI + API blocked; upgrade CTA |
| **Invoices** | **Yes** — max **25 created per calendar month** |
| **Quotes** | **No** |
| **Saved customers** | **Yes** — save and reuse on invoices (max **50** on Free) |
| **Payment status on invoices** | **Yes** — mark sent / paid / overdue |
| **Static DuitNow on invoice** | **No** |
| **Dynamic DuitNow / Billplz checkout** | **No** |
| **Receipt / file attach to expenses** | **No** (expenses blocked) |
| **Full ledger / P&L / export pack** | **No** |
| **e-Invoice / SST advanced** | **No** |
| **Email send invoice** | **Yes** — max **25/month** (same pool as invoice creation) |
| **WhatsApp reminder text** | **Yes** — copy-paste helper only |

### 4.3 Other Free limits

| Limit | Value |
|-------|--------|
| Seats | **1** owner |
| Storage | **200 MB** |
| AI agents | **0** — no agents, no credits |
| Saved customers | **50** |

### 4.4 Free upgrade triggers (design for these moments)

1. **Invoice cap** — “You've used 25/25 invoices this month.”
2. **Expense attempt** — “Track expenses on Basic (RM39) or Solo (RM79).”
3. **Any other module** — Operations, HR, Marketing (or full six-module stack).
4. **DuitNow on invoice** — “Add payment QR on paid plans.”
5. **Customer cap** — “You've saved 50/50 customers — upgrade for more.”
6. **Storage** — “You've used 200 MB — upgrade for more file space.”
7. **AI** — “Three agents on Basic; six on Solo+ when you subscribe.”

**Free tagline:** *Issue a few invoices. See the workflow. Upgrade when the business gets real.*

---

## 5. Paid plans

### 5.0 Basic — RM39/month (freelancer)

**For:** Solo freelancers who only need **admin desk + sales + finance** — not stock, HR, or marketing ops.

| | |
|--|--|
| Modules | **Admin**, **Sales**, **Finance** (full Finance on these three pillars) |
| Locked | Operations, HR, Marketing, Boardroom |
| Seats | **1** |
| Customers | **200** |
| Storage | **1 GB** |
| Outbound email | **COGS-guarded** (same rules as §5.6; lower MRR → tighter guardrail) |
| AI agents | **3 included** — **Amir** (Admin), **Sufi** (Sales), **Fayza** (Finance) |
| AI model | **ILMU Mini 3.3 only** — no deep / slow reasoning mode on Basic |
| AI credits / month | **60** (20 × 3 agents) |
| Boardroom | **No** |

**Upgrade path:** Operations / HR / Marketing module walls → **Solo (RM79)** for all six modules + three more agents + Boardroom.

**Solo+** (Solo, Micro, Small, Scale) on subscribe / renewal:

1. Unlock **all six core modules**.
2. Unlock **all six module AI agents** — no marketplace monthly SKU.
3. Grant bundled credits — **20 per agent per month** (tier multiplier below).
4. **Boardroom** when **2+ agents** have credits remaining.

### 5.1 Solo — RM79/month

| | |
|--|--|
| Modules | All six core |
| Seats | **1** |
| Customers | **500** |
| Storage | **5 GB** |
| Outbound email | **Unlimited** (COGS-guarded — see §5.6) |
| AI agents | **All 6 included** |
| AI model | ILMU Mini 3.3 default; deep mode available (2× credits) |
| AI credits / month | **120** (20 × 6 agents) |

### 5.2 Micro — RM169/month (primary tier)

| | |
|--|--|
| Modules | All six core |
| Seats | **5** |
| Customers | **2,000** |
| Storage | **15 GB** |
| Outbound email | **Unlimited** (COGS-guarded) |
| AI agents | **All 6 included** |
| AI credits / month | **180** (30 × 6 agents) |

### 5.3 Small — RM299/month

| | |
|--|--|
| Modules | All six core |
| Seats | **12** |
| Customers | **10,000** |
| Storage | **40 GB** |
| Outbound email | **Unlimited** (COGS-guarded) |
| AI agents | **All 6 included** |
| AI credits / month | **360** (60 × 6 agents) |

### 5.4 Scale — RM429/month (optional)

| | |
|--|--|
| Seats | **25** |
| Customers | **50,000** |
| Storage | **100 GB** |
| Outbound email | **Unlimited** (COGS-guarded) |
| AI credits / month | **600** (100 × 6 agents) |

### 5.5 Paid Finance (full) vs Free lite

| Capability | Free lite | Basic / Solo+ Finance |
|------------|-----------|------------------------|
| Expenses | No | Yes |
| Income | Yes | Yes |
| Invoices / month | 25 cap | Plan fair-use (high quota) |
| Quotes | No | Yes |
| Saved customers | Yes (max **50**) | Yes (plan customer quota) |
| Static DuitNow | No | **Yes** (core — not an add-on) |
| Ledger, P&L, export | No | Yes |
| e-Invoice workflow | No | **Yes** (core compliance) |
| Outbound email | **25/month** (shared with invoices) | **Unlimited** (COGS-guarded — §5.6) |

### 5.6 Paid outbound email — unlimited, COGS-guarded

Paid plans do **not** cap invoice, statement, or marketing email sends with a fixed monthly number. Sends are **unlimited** as long as the customer’s **subscription revenue covers attributable variable COGS** for that business.

| Rule | Detail |
|------|--------|
| **Included sends** | Invoices, payment reminders, statements, reports, broadcasts, digests — all Resend-backed app email |
| **No fixed quota** | No per-tier “200 / 1,000 / 3,000” email caps on paid plans |
| **COGS guardrail** | Each month, compute per `business_id`: email provider cost + AI inference cost + storage egress (variable only) |
| **Coverage test** | Total variable COGS stays **≤ 20% of plan MRR**, or **net variable margin on the account remains positive** |
| **Typical micro-SME** | ~50–300 emails/mo — well inside Resend included tiers; plan MRR easily covers |
| **Heavy sender** | Campaign-heavy tenants may hit guardrail → see escalation |

**Escalation ladder (automated + support)**

1. **Warn** — owner email/in-app when email COGS &gt; **15% of plan MRR** in rolling 30 days.
2. **Throttle marketing** — pause **broadcasts / campaigns**; keep **transactional** (invoice, password, receipt) flowing.
3. **Require action** — buy **email overflow pack** (§9) or **upgrade tier** before resuming bulk sends.
4. **Abuse** — spam complaints, bounce rate, or ToS violation → suspend sends; manual review.

**Why this works:** Most paid customers send few emails; unlimited removes friction. Heavy volume is either a business that should upgrade, or funded by overflow pack. **Free** stays capped (§4.2).

**Implementation:** `business_usage_monthly` rollup — `emails_sent`, `email_cogs_myr`, `ai_cogs_myr`, `plan_mrr_myr`, `guardrail_status`.

---

## 6. AI agents & credits

### 6.1 Model

| Rule | Detail |
|------|--------|
| Agent unlock | **Basic:** 3 agents (Admin, Sales, Finance). **Solo+:** all **6 agents**. No RM20/agent subscription. |
| Default model | **ILMU Mini 3.3** (`ilmu-mini-v3.3`) on **all tiers** |
| Deep reasoning | **Basic:** **blocked** — Mini only. **Solo+:** allowed at **2×** credit cost |
| Monthly grant | **20 credits per included agent** (Basic **60**; Solo **120**; tier multipliers in §5) |
| Credit pool | **Shared business pool** — spend from one balance |
| Grant timing | On subscription start + each **monthly renewal** (and promo grant on provision — §12) |
| Rollover | **Bundled monthly credits do not roll over** (use or lose) |
| Top-up credits | **Roll over** until used |
| At zero credits | **Pause** AI fast mode — show top-up or wait for renewal |
| Daily budget | Owner-configurable cap (existing **10–200 credits/day**) to prevent surprise burn |

### 6.2 Credit consumption (retail)

| Action | Credits (fast / Mini) |
|--------|------------------------|
| Chat message | **1** |
| Agent action (leave approve, task create, etc.) | **2** |
| Deep reasoning mode | **2×** chat / action |
| Boardroom depth checkpoint | **10** (existing) |

**Retail value:** **RM0.10 per credit** (100 credits = RM10). Top-up priced slightly above retail to protect margin.

### 6.3 Top-up pricing

| Pack | Price | Notes |
|------|-------|-------|
| **100 credits** | **RM10** one-time | Primary top-up SKU (see §9 for catalog price) |
| **300 credits** | **RM28** one-time | ~7% discount vs 3×100 |
| **500 credits** | **RM45** one-time | Power users / Boardroom (Solo+) |

No monthly “AI agent pack” add-on — agents are **plan-included**; only **credits** are sold.

### 6.4 Why this does not lose money

| Factor | Control |
|--------|---------|
| Bundled grant | Basic **60** · Solo **120** · up to **360** on Small — retail value below plan price |
| Basic model lock | Mini 3.3 only keeps inference COGS **&lt;10%** of RM39 MRR at typical usage |
| Typical usage | Most micro-SMEs use **&lt;80 credits/mo** if guided (morning notice + a few chats) |
| Provider cost | Record **actual ILMU tokens** in `ai_usage`; bundled grant is marketing cost, not unlimited inference |
| Heavy users | **Top-up** + **daily budget**; Boardroom and deep mode (Solo+) cost more credits |
| Free tier | **Zero** AI — no inference COGS on free |

**Target:** Bundled credits cost **&lt;15% of plan MRR** at p75 usage; top-ups and upgrades to Micro/Small fund power users.

### 6.5 Marketplace change (implementation)

| Old | New |
|-----|-----|
| `admin-assistant` … `marketing-assistant` at **RM20/mo** each | **Entitlement from paid plan** — slugs stay for metering, not monthly SKU |
| `boost-credits-300` | Keep as top-up product |
| Per-agent monthly add-on | **Remove** from purchasable catalog |

---

## 7. Six core modules

| Module | Basic | Solo+ (core on paid) |
|--------|-------|---------------------|
| **Finance** | Yes (full on Finance pillar) | Income + expense, quotes, invoices, receipts, payment status, P&L, e-Invoice, static DuitNow |
| **Sales** | Yes | Customers, leads, basic POS, sales history |
| **Admin** | Yes | Tasks, document vault, compliance dates, basic audit |
| **Operations** | Locked | Products/services, stock, suppliers, orders, bookings |
| **HR** | Locked | Employees, leave, balances, **public holidays (MyCal)** |
| **Marketing** | Locked | CRM, segments, content calendar, coupons, manual broadcasts |
| **Boardroom** | No | Meeting room when 2+ agents active + credits (Solo+ only) |

Premium automation stays in add-ons; **minimum complete workflow** is included per tier.

---

## 8. Moved from add-ons → core (no separate “free add-on” subscription)

These are **included in the product** so customers do not buy a zero-price marketplace row.

| Former add-on / pack | Now |
|----------------------|-----|
| **Malaysia public holidays** (`hr-public-holidays`) | **Core HR** on paid — MyCal import |
| **Starter document templates** (invoice, quote, offer letter) | **Core** — all paid tiers |
| **Business setup checklist** (SSM, licences) | **Core onboarding** + Admin on paid |
| **Static DuitNow QR** on invoices | **Core Finance/Sales** on paid — **not** on Free |
| **All six module AI agents** | **Core on Solo+** — credits meter usage; **3 on Basic** |
| **Outbound email on paid** | **Unlimited** — COGS-guarded (§5.6), not a separate add-on |
| **Saved customers on Free** | **Core Finance lite** — up to **50** saved customers |

Still **add-ons** (automation, integration, scale): recurring invoices, bank recon, WhatsApp API, payroll statutory, advanced inventory, extra storage/seats, credit top-ups.

---

## 9. Add-on pricing (paid plans only)

**Rules:** Free cannot buy. **Basic and Solo+** can stack multiple add-ons. Prices are **~50% lower** than the prior catalog so tenants can subscribe to several without hitting a single “big” SKU.

**Ceiling:** No single recurring add-on above **50% of that tenant’s plan MRR** — Basic **RM20**, Solo **RM40**, Micro **RM85**, Small **RM150**.

| Add-on | Type | Price (scaled) | Prior (reference) |
|--------|------|----------------|-------------------|
| Extra staff seat | Scale | **RM9 / seat / month** | RM18 |
| Extra 10 GB storage | Scale | **RM5 / month** | RM10 |
| Email overflow pack (2,000 sends) | Usage | **RM5 / month** | RM10 | COGS guardrail only (§5.6) |
| 100 AI credits top-up | Usage | **RM10** one-time | RM12 |
| 300 AI credits top-up | Usage | **RM28** one-time | RM32 |
| 500 AI credits top-up | Usage | **RM45** one-time | RM50 |
| Recurring invoices | Feature | **RM9 / month** | RM18 |
| Customer booking page | Feature | **RM9 / month** | RM18 |
| Advanced inventory | Feature | **RM9 / month** | RM18 |
| Marketing automation | Feature | **RM11 / month** | RM22 |
| Staff self-service HR | Feature | **RM9 / month** | RM18 |
| Shift + attendance bundle | Bundle | **RM16 / month** | RM32 |
| Bank reconciliation | Integration | **RM14 / month** | RM28 |
| Digital signature | Usage | **RM8 + RM1 / doc** | RM12 + RM2 |
| WhatsApp Business API | Integration | **RM16 / month + Meta** | RM32 |
| Payroll statutory pack | Integration | **RM16 + RM1 / employee** | RM32 + RM2 |
| Shopee / TikTok sync | Integration | **RM14 / channel** | RM28 |

**Example stack (Basic RM39):** recurring invoices (RM9) + booking page (RM9) + bank recon (RM14) = **RM63/mo** total — still under typical Bukku-style accounting-only pricing.

**Removed from add-on catalog:** Per-module AI agent monthly fee (agents are plan-included).

---

## 10. Structural changes from legacy

| Topic | Legacy | This plan |
|-------|--------|-----------|
| Free storage | 2 GB in draft | **200 MB** |
| Free module | Finance only (loosely enforced) | **Finance lite** with hard caps |
| Freelancer tier | — | **Basic RM39** — Admin + Sales + Finance, 3 agents, 1 GB |
| Free invoices | Unlimited in code | **25 / month** |
| Free DuitNow | Sometimes shown | **Blocked** |
| Paid modules | Gated by tier | **3 on Basic · all six on Solo+** |
| AI agents | RM20/mo × 6 possible | **3 on Basic · 6 on Solo+** |
| AI model | Mixed | **Mini 3.3 default; deep mode Solo+ only** |
| AI credits | 100/agent if addon subscribed | **20/agent included**, tier multipliers |
| Add-on prices | RM18–32/feature | **~50% lower** — stackable |
| Prices | RM69 / 139 / 249 | **RM39 / 79 / 169 / 299** |
| Campaign provisioning | Manual / ad hoc | **Super-admin create client** + promo tier |

---

## 11. Implementation checklist

### Free tier enforcement

- [ ] Block `/finance/expenses` and expense APIs for `tier === starter`.
- [ ] Counter **invoices created per month**; block at 25 with upgrade modal.
- [ ] Block **static DuitNow** toggle on Free.
- [ ] Enforce **50 saved customers** on Free; paid uses plan customer quota.
- [ ] Enforce **200 MB** storage on Free; **1 GB** on Basic; tier quotas on Solo+.
- [ ] Block quotes, ledger, export on Free.
- [ ] Keep **income** create/list enabled.

### Basic tier

- [ ] Add `TierKey` **`basic`** to `plans.ts`, billing, and compare UI.
- [ ] `entitlements.ts` — pillars **admin, sales, finance** only for `basic`; lock ops/hr/marketing.
- [ ] Entitle agents **Amir, Sufi, Fayza** only; grant **60** credits/month on subscribe/renewal.
- [ ] Route all Basic AI calls to **ILMU Mini 3.3**; reject deep/slow mode server-side.
- [ ] Block Boardroom for `tier === basic`.

### Paid tier + AI (Solo+)

- [ ] `entitlements.ts` — all six pillars for `micro`, `sme`, `enterprise`.
- [ ] On Solo+ subscription activate: grant credits per tier multiplier (§5).
- [ ] Auto-entitle six agent slugs without `business_addons` monthly charge.
- [ ] Deprecate marketplace **RM20/agent** purchase UI for paid businesses.
- [ ] Update `MONTHLY_CREDITS_PER_AGENT` from 100 → tier-based grant logic.
- [ ] Top-up SKUs at §6.3 / §9 scaled prices.

### Plans catalog

- [ ] `lib/settings/plans.ts` — Basic + Solo / Micro / Small prices, quotas, labels.
- [ ] Subscription compare table + home Free banner text.
- [ ] Remove `hr-public-holidays` from required marketplace activation on Solo+.

### Super-admin — create client account

- [ ] **`/super-admin/clients/create`** (or extend businesses) — provision tenant + owner without self-serve sign-up.
- [ ] Fields: business name, owner email, display name, **`tier`** (Free / Basic / Solo / Micro / Small).
- [ ] **Promo grant:** optional **complimentary tier** for N months (e.g. **Solo 3 months free** for campaign leads).
- [ ] Persist on `businesses` or `subscription_promotions`: `promo_tier`, `promo_ends_at`, `campaign_code`, `granted_by` (platform admin id).
- [ ] On create: invite owner via Supabase Auth; apply entitlements + credit grant immediately.
- [ ] Audit every provision in `super_admin_audit` (who created, tier, promo, campaign).
- [ ] At `promo_ends_at`: downgrade to chosen paid tier (if card on file) or **Free** with 7-day grace + email.
- [ ] API: `POST /api/super-admin/clients` + optional `promo: { tier, months }`.

### Metering & margin

- [ ] **No fixed email quota** on paid — implement COGS guardrail (§5.6).
- [ ] Roll up per tenant: `emails_sent`, `email_cogs_myr`, `ai_cogs_myr`, `plan_mrr_myr`.
- [ ] Throttle broadcasts when guardrail breached; keep transactional email.
- [ ] Persist provider token cost on every AI call for margin reporting.
- [ ] Invoice counter on Free (25/mo); email counter on Free (25/mo, shared pool).

---

## 12. Super-admin — create client account & campaign promos

Platform staff provision tenants for **campaigns, partnerships, and sales-assisted onboarding** — not only self-serve sign-up.

### 12.1 Create client account

| Field | Required | Notes |
|-------|----------|-------|
| Business name | Yes | Display + invoice header |
| Owner email | Yes | Supabase invite / magic link |
| Owner display name | Optional | Defaults from email |
| **Plan tier** | Yes | `starter` · `basic` · `micro` (Solo) · `sme` · `enterprise` |
| **Promo grant** | Optional | Complimentary higher tier for N months |
| Campaign code | Optional | e.g. `MSME-ROADSHOW-2026` for reporting |
| Internal notes | Optional | Sales / support context |

**Flow:**

1. Platform admin opens **Super Admin → Clients → Create**.
2. System creates `businesses` row, invites owner, sets `tier` (or promo tier if granted).
3. Entitlements + bundled credits apply **immediately** (same as paid subscribe).
4. Row written to `super_admin_audit`.

### 12.2 Promo tier examples

| Campaign use | Promo | After promo ends |
|--------------|-------|------------------|
| Roadshow / MSME event | **Solo (`micro`) — 3 months free** | Bill chosen tier or downgrade to Free |
| Partner pilot | **Micro (`sme`) — 1 month free** | Bill Micro or downgrade |
| Freelancer funnel | **Basic — 14 days free** | Bill Basic RM39 or Free |

**Rules:**

- Promo tier **≥** selected post-promo tier (don’t grant Small then expect Basic payment without consent).
- **Credit grant** during promo = full tier bundle (e.g. Solo **120** credits/month even while free).
- **One active promo per business**; extending requires new audit entry.
- Owner sees in-app banner: “Campaign access — Solo until {date}.”

### 12.3 Implementation surface

- UI: `app/(super-admin)/super-admin/clients/create/page.tsx` (or modal on businesses list).
- API: `POST /api/super-admin/clients` with body `{ businessName, ownerEmail, tier, promo?: { tier, months }, campaignCode? }`.
- DB: `subscription_promotions` or columns on `businesses` — `promo_tier`, `promo_started_at`, `promo_ends_at`, `post_promo_tier`, `campaign_code`.
- Cron: `subscription-promo-expiry` — downgrade / start billing at `promo_ends_at`.

See also [`architecture/super-admin.md`](./architecture/super-admin.md).

---

## 13. Trials, annual, discounts

| Rule | Detail |
|------|--------|
| Free | Permanent; no card |
| Self-serve paid trial | **7 days on Basic only** — 20 credits. Unused bundle credits expire when the trial ends. Subscribe to Basic, Solo, SME, or Small during trial: leftover credits + that plan’s monthly bundle. Existing 14-day Solo trials keep their clock; expiry uses the same credit wipe. |
| Super-admin promo | **N months free** on any tier (§12) — for campaigns, not self-serve |
| Annual | **2 months free** (pay 10, get 12) on Basic, Solo, Micro, Small |
| Early founder | First **100 businesses**: lock price **12 months** |
| Multi-business | **10% off** second `business_id` |

---

## 14. Open decisions

1. **Scale (RM429)** — launch when a customer needs &gt;12 seats.
2. **Invoice fair-use cap on paid** — soft cap (e.g. 500/mo Solo) vs unlimited with abuse monitoring.
3. **Grandfathering** — RM69/139/249 customers: 12-month legacy price?
4. **SST** — prices shown **excl. 8% SST** on marketing site?
5. **Credit grant on mid-month upgrade** — full grant vs prorated?
6. **Basic → Solo upgrade** — prorate difference or immediate full six-module unlock?
7. **Post-promo billing** — require card on provision vs at promo end only?

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-08-07 | Middle ground RM79/169/299 |
| 2026-08-07 | Free: strict Finance lite (25 invoices, no expenses, no DuitNow); paid: 6 agents included, 20 credits/agent/mo, top-ups; core vs add-on merge |
| 2026-08-07 | Free: saved customers (50 cap); paid: unlimited email COGS-guarded, no per-tier email caps |
| 2026-08-07 | Added `docs/pricing-forecast-y1.md` — Year 1 revenue & gross profit (COGS only, no salary) |
| 2026-08-07 | **Basic RM39** (Admin+Sales+Finance, 3 agents, Mini 3.3, 1 GB); Free **200 MB**; add-ons ~50% cheaper; super-admin create client + promo tiers |
| 2026-08-07 | Updated `docs/pricing-forecast-y1.md` for Basic tier mix and scaled add-ons |
| 2026-08-07 | Added `docs/plans/pricing-plan-implementation.md` — phased implementation plan |

**Related:** `lib/settings/plans.ts`, `lib/settings/credit-pricing.ts`, `lib/auth/entitlements.ts`, `docs/marketplace-addons.md`, `docs/pricing-forecast-y1.md`, `docs/plans/pricing-plan-implementation.md`.
