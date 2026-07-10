# Bantu Niaga — Team Direction (2026)

> **Purpose:** Align the team on who we build for, what we charge, how we scale, and what we decide next.  
> **Audience:** Product, engineering, design, go-to-market.  
> **Owner:** Founder — circulate before team workshop; capture answers in §6 Decision log.  
> **Related:** [target-market.md](./target-market.md) · [pricing-plan.md](./pricing-plan.md) · [entitlements.md](./architecture/entitlements.md) · [tech-stack.md](./architecture/tech-stack.md) · [PRD.md](./PRD.md)

---

## 1. North star (read this first)

**We are building the operating system for Malaysian micro-SMEs** — owner-led businesses under roughly **RM 5 million yearly revenue**, not enterprise ERP buyers.

| We optimise for | We do not optimise for (v1) |
|-----------------|----------------------------|
| Solo operators, kedai, cafes, salons, online sellers with small teams | Large factories, multi-country ERP, 500-seat call centres |
| Simple monthly price, feels “complete” at Growth | À-la-carte add-on fatigue |
| Mobile execution + desktop control (dual-mode) | Desktop-only accounting replacement |
| Shared platform, fast ship, one codebase | Per-tenant database from day one |

**Positioning in one line:**  
*Organise the business → manage staff and sales → grow customers — without ERP complexity.*

Larger companies may use Bantu Niaga; we welcome them on **Pro + premium add-ons**, but we do not redesign the core product for them first.

---

## 2. Decisions already locked (don’t re-debate without strong reason)

These are reflected in code and architecture docs today.

| Area | Decision | Where it lives |
|------|----------|----------------|
| **Target revenue band** | Primarily under RM 5M/year; individual → micro → small SME | [target-market.md](./target-market.md) |
| **Multi-tenancy** | One Postgres, shared schema, `business_id` + RLS | [entitlements.md](./architecture/entitlements.md), [tech-stack.md](./architecture/tech-stack.md) |
| **Tier model** | Free → Starter RM69 → Growth RM139 → Pro RM249 | [plans.ts](../lib/settings/plans.ts), [pricing-plan.md](./pricing-plan.md) |
| **Module gating** | Tiers unlock pillars; add-ons unlock premium inside pillars | [entitlements.md](./architecture/entitlements.md) |
| **AI** | Optional premium; credits pool; ILMU preferred | [ai/agents.md](./ai/agents.md) |
| **Infra path** | Vercel + Supabase Singapore; scale to Team tier before splitting DB | [tech-stack.md](./architecture/tech-stack.md) §10 |
| **Compliance baseline** | PDPA, tenant isolation, audit log | [pdpa.md](./architecture/pdpa.md) |

---

## 3. Strategic direction (proposed — team must confirm)

### 3.1 Product packaging — customer language (not IT)

**Do not show customers “CORE / POWER / PREMIUM”.** Use this instead:

| What we say to customer | Meaning | Example |
|-------------------------|---------|---------|
| **Asas (dalam plan)** | Everything you need at that plan level | Invois, belanja, stok asas |
| **Lengkap untuk team kecil** | Included when you pick **Growth** | POS, cuti staff, rekod pekerja |
| **Tambahan (pilihan)** | Only if your business type needs it | Gaji EPF/SOCSO, stok cawangan, Shopee sync |

**One sentence for customers:**  
*“Pilih jenis perniagaan — kami cadangkan plan yang sesuai. Tambahan hanya jika anda perlukan.”*

The old CORE / POWER / PREMIUM box is **for the team only** when deciding what to build into each tier vs marketplace.

### 3.2 Onboarding: “Apa jenis perniagaan anda?” (recommended)

**Verdict: Yes — this is the right UX for non-IT owners.**

After sign-up, ask **3–5 simple questions** (not a long form):

1. **Jenis perniagaan** (pick one icon)  
   Kedai runcit · Kafe/F&B · Salon/servis · Jual online · Freelancer · Lain-lain  
2. **Berapa orang team?**  
   Sendiri · 2–5 · 6–15 · 16+  
3. **Apa yang paling penting sekarang?** (pick up to 2)  
   Invois & bayaran · Jualan kaunter · Stok · Cuti staff · Marketing pelanggan  

Then show **one recommendation card**, not a price matrix:

```
┌─────────────────────────────────────────────┐
│  Cadangan untuk: Kafe kecil (6 staff)        │
│                                              │
│  Plan: Growth — RM139/bulan                  │
│  Termasuk: POS, cuti, stok asas, invois      │
│                                              │
│  Pakej tambahan (jimat 15%):                 │
│  ☑ HR Assistant (Azam)                        │
│  ☐ Gaji & EPF (bila anda sedia)              │
│                                              │
│  [ Mula percuma 14 hari ]  [ Tukar plan ]    │
└─────────────────────────────────────────────┘
```

**Rules:**

- User can always **skip** and choose plan manually (“Saya nak pilih sendiri”).  
- Recommendation is **editable** — never lock them in.  
- Save answers on `businesses` (e.g. `business_type`, `team_size_band`) for analytics and support.

**Why this works:** Owner thinks *“system faham kedai saya”* — not *“system macam ERP”*.

### 3.2.1 Free-first onboarding (locked)

**Free is the default “try it” path.** The quiz and business bundles are optional helpers for owners who want a paid-plan recommendation.

| Rule | Decision |
|------|----------|
| Can you sign up without the quiz? | **Yes, always** |
| Default CTA on sign-up | **Start free** (invoices & payments, no card) |
| Secondary CTA | **14-day Starter trial** or **Help me choose** (quiz) |
| Does quiz force a paid plan? | **No** |
| Can quiz recommend Free? | **Yes** — solo freelancer / invoicing-only |
| Do bundles apply to Free? | **No** — add-ons require a paid plan |
| When to push upgrades? | When they open a locked module or after real usage (e.g. 3–5 invoices), not at registration |

**Sign-up screen (implemented):**

```
[ Start free — invoices & payments ]     ← primary default
[ 14-day Starter trial ]
[ Help me choose a plan ]                ← /sign-up/guide
```

**First login (Free tier):** Show a short banner — *“You’re on Free — great for invoicing. Upgrade when you need expenses, stock, or staff.”* No marketplace push on day one.

**Upgrade moments (not at sign-up):**

| Moment | Action |
|--------|--------|
| Locked module | Existing lock → subscription page |
| Settings → Subscription | Compare plans manually (quiz is pre-sign-up only) |
| After usage milestone | Soft tip (future): expenses on Starter |

### 3.3 Business-type bundles (discount vs à la carte)

**Verdict: Yes — bundle by business type, discount ~10–20% vs buying add-ons separately.**

| Bundle name | For who | Plan | Add-ons in bundle | Bundle price (example) | If bought separate |
|-------------|---------|------|-------------------|------------------------|-------------------|
| **Pakej Kedai** | Kedai runcit | Growth | Azam HR + Dynamic QR | RM169/mo | RM179 |
| **Pakej Kafe** | F&B, counter staff | Growth | Azam HR + Daily close-out | RM179/mo | RM194 |
| **Pakej Online** | Shopee/TikTok seller | Pro | Shopee sync + Marketing AI | RM289/mo | RM314 |
| **Pakej Servis** | Salon, homestay | Starter or Growth | Booking page + Azam | RM99–159/mo | higher |

**Principles:**

- **Bundle = plan + curated add-ons** — one checkout, one invoice line on Billplz.  
- **À la carte** in Marketplace stays at **full price** (creates fair reason to take bundle).  
- Bundles are **presets**, not new code modules — same add-on slugs, `marketplace_activate_bundle` RPC later.  
- Show: ~~RM194~~ **RM179** — “Jimat RM15 dengan Pakej Kafe”.

**Phase 1 (implemented):** `/onboarding/recommendation` after sign-up — step-by-step plan + add-on activation; bundle total with 15% add-on discount shown in copy.  
**Phase 2 (planned):** Single “Activate pack” button via `POST /api/marketplace/activate-bundle` + `marketplace_bundles` table.

**Locked recommendations:**

| Principle | Decision |
|-----------|----------|
| Onboarding quiz | Yes — good for Malaysian micro-SMEs |
| Business bundles | Yes — clearer than marketplace grid alone |
| Bundle discount | ~15% on add-ons only — à la carte stays full price |
| Manual choice | Always allowed — skip, subscription page, or Marketplace |
| Payroll in bundles | Optional only — never pre-selected |

### 3.4 Product packaging (team view — CORE / POWER / PREMIUM)

```
┌──────────────────────────────────────────────────────────────┐
│  CORE (in tier)     — must feel complete for that tier        │
│  POWER (Growth+)    — HR, sales, basic stock, 1 AI bundle     │
│  PREMIUM (add-on)   — payroll statutory, deep inventory, sync │
└──────────────────────────────────────────────────────────────┘
```

**Principle:** A kedai with 8 staff on **Growth** should run daily ops **without** buying five RM20 add-ons.

| Layer | Examples | Pricing stance |
|-------|----------|----------------|
| **Core** | Invoices, e-invoice, expenses, customers, tasks, basic catalogue | Free / Starter |
| **Power** | Leave, staff records, POS-lite, HR AI (Azam), daily sales | **Included in Growth** (team to confirm if 1 AI agent bundled) |
| **Premium** | Statutory payroll (EPF/SOCSO/PCB), multi-costing inventory, Shopee/TikTok sync | Add-on RM49–99; only when needed |

### 3.5 Build order (locked): core modules first, add-ons later

**Rule:** Do **not** implement new paid add-ons until every **core module** for the current release is finished or settled (stable enough to sell without the add-on).

| Order | Focus | Examples |
|-------|--------|----------|
| **1. Core settle** | Admin, Finance, Operations, Sales, Marketing, HR **included** features | Invoices, expenses, leave, staff records, POS-lite, customers, tasks, storage |
| **2. Platform settle** | Auth email (Resend/SMTP), Billplz live checkout, invite email | Needed before charging real money |
| **3. Add-ons** | Premium / Marketplace packs | Payroll, advanced leave, roster, time clock, contracts, deep inventory, Shopee sync |

**What “settled” means:** Core flows work end-to-end for a real kedai/kafe demo; known gaps are documented as 🟡; no half-built add-on UI that promises features we cannot deliver.

**Until then:** Keep Marketplace add-ons as **coming soon / gated** (placeholders OK). Do not build payroll, staff portal, advanced leave policy, roster, etc. while core pillars still have open 🟡 items.

**Exception:** Bug fixes and security on already-shipped add-ons (e.g. Hana, public holidays, appraisal) are allowed anytime.

### 3.2 Infrastructure: stay shared until paid to split

| Stage | Tenants (paying) | Database strategy |
|-------|------------------|-------------------|
| **Now** | 0–500 | Single Supabase project, RLS, indexes on `business_id` |
| **Growth** | 500–2,000 | Archive `ai_usage` / heavy logs; read replicas if needed |
| **Scale** | 2,000–10,000 | Supabase Team, connection pooling, job queues |
| **Enterprise** | Few large clients | **Optional** dedicated project only if contract ≥ ~RM2k/mo |

**Do not** plan per-tenant databases for micro-SMEs — ops cost and migration pain outweigh benefits at our target size.

### 3.3 Data size expectations (set team expectations)

Typical micro/small SME after 2 years: **~100 MB–2 GB** (mostly files in Storage).  
1,000 such tenants ≈ **50–200 GB** Postgres — well within Supabase Pro/Team.

Peak risk is **concurrency and AI**, not row count. Mitigate with rate limits, credits, cron staggering, and caching — not DB splitting.

### 3.4 Who we say “no” to (politely)

- Custom schema per client (unless enterprise contract)
- Full manufacturing ERP (BOM, MRP) in v1
- Competing head-on with SQL Account desktop depth in year one
- Pricing that requires a spreadsheet to understand

---

## 4. Open decisions (team workshop)

Mark each **Decide / Defer / Reject** in §6 after the session.

| # | Topic | Options | Recommendation |
|---|-------|---------|----------------|
| D1 | **Bundle HR AI in Growth?** | A) RM20 add-on only · B) Include 1 agent in Growth · C) 3-month promo then add-on | **B** — differentiation vs Bukku/BizCore |
| D2 | **Growth price** | Keep RM139 · Raise to RM149–169 when payroll-adjacent HR is stable | Defer raise until e-invoice + HR core stable |
| D3 | **Payroll pack positioning** | Add-on only · Included in Pro · Separate “Compliance” tier | **Add-on RM99–149** when statutory features ship |
| D4 | **Deep inventory** | Always add-on · Basic stock in Ops for all paid tiers | Basic in Starter+; **Advanced Inventory** add-on |
| D5 | **Marketplace UX** | Long list · 3 bundles · **Onboarding quiz + business bundles** | **Quiz + bundles** (§3.2–3.3) |
| D6 | **Free tier limits** | Keep no customers · Allow 50 customers on Free | Keep strict — upgrade trigger to Starter |
| D7 | **Annual discount** | 2 months free · 15% off · None in year one | **2 months free** per [pricing-plan.md](./pricing-plan.md) |
| D8 | **Archive policy** | When to roll up `ai_usage` rows | >90 days → daily rollup (partially built) |
| D9 | **Enterprise door** | Pro only · Pro + “Dedicated support” RM500+ | Pro + support pack; no separate DB unless paid |
| D10 | **First vertical focus** | F&B · Retail kedai · Services · No vertical | Pick **one** for marketing copy + 2 demo tenants |
| D11 | **Onboarding quiz at sign-up?** | Yes / After first login / Defer | **Yes** — 3 questions, skippable |
| D12 | **Bundle discount %** | 10% · 15% · 20% | **15%** on add-ons in bundle only |

---

## 5. Questions to ask the team

Use these in a 90-minute workshop. Assign a **note-taker**; answers go to §6.

### 5.1 Customer & market (15 min)

1. Who is our **first paying customer** archetype? (Name a real business type, not “SME”.)
2. What is the **one job** they pay for in month 1? (Invoice? POS? Leave? AI?)
3. Is **RM 5M revenue cap** the right ceiling for positioning, or do we say “under 30 staff” instead?
4. Which **three business examples** from [target-market.md](./target-market.md) will we demo on the website?
5. Are we okay being **not** a payroll-first product for the first 12 months?

### 5.2 Packaging & pricing (20 min)

6. On **Growth (RM139)**, what must work **with zero add-ons**? List max 5 capabilities.
7. Which add-ons are **confusing** today? Which should be hidden until tier-qualified?
8. Should **HR Assistant (Azam)** be included in Growth or stay RM20/month?
9. When payroll ships, is **RM99/month flat** acceptable vs per-employee (e.g. RM8/head)?
10. What is our **“too expensive”** signal? (e.g. starter churn, support tickets, competitor quotes)
11. Do we offer **14-day trial** on all paid tiers at public launch? Credit card required?

### 5.3 Product & engineering (20 min)

12. What is **v1 done** for HR? (Leave only vs appraisal vs payroll estimate)
13. What is **v1 done** for Operations inventory? (Qty tracking vs multi-location vs BOM)
14. Which module is **most fragile** today? Block launch or ship with banner?
15. Are we comfortable with **shared database + RLS** for 1,000 tenants? What would change your mind?
16. What is the **first scale bottleneck** we expect: AI, Postgres, Vercel, or Storage?
17. Do we need **Redis** (rate limits, queues) before 500 tenants, or defer?

### 5.4 Go-to-market & team (15 min)

18. Who sells first — founder only, or partner/reseller (e.g. accounting firm)?
19. What language for ads: **BM, English, or mixed**?
20. One **killer sentence** for Facebook/IG ads?
21. Who owns **support** when a tenant’s payroll is wrong? (Scope of liability)
22. What do we **not build** in Q3 2026? (Force prioritisation)

### 5.5 Legal & trust (10 min)

23. PDPA: is our **data residency story** “Singapore region, Malaysian business data” enough for customers?
24. When payroll goes live, do we need **insurance / disclaimer** (“estimates only, not tax advice”)?
25. Terms of service: **AI outputs** — who is liable for wrong leave approval?

### 5.6 Success metrics (10 min)

26. **90-day goal:** paying businesses? MRR? Retention?
27. What is **one metric** that proves micro-SME fit? (e.g. % tenants with ≤5 seats)
28. When do we revisit **pricing**? (e.g. after 50 paying, or after payroll launch)

---

## 6. Decision log (fill in after workshop)

| Date | ID | Decision | Owner | Notes |
|------|-----|----------|-------|-------|
| | D1 | | | |
| | D2 | | | |
| | D3 | | | |
| | D10 | | | |
| | | | | |

---

## 7. Suggested 90-minute agenda

| Time | Activity | Output |
|------|----------|--------|
| 0:00 | Founder reads §1–3 (10 min max) | Shared context |
| 0:10 | §5.1 Customer & market | Pick demo vertical + first payer job |
| 0:25 | §5.2 Packaging & pricing | Agree “Growth complete” list + D1/D3 |
| 0:45 | §5.3 Product & engineering | v1 scope per module; scale stance |
| 1:05 | §5.4–5.5 GTM + legal | Owner assignments |
| 1:20 | §5.6 Metrics + §4 open decisions | Fill §6 decision log |
| 1:30 | Assign actions (who updates pricing doc, CHECKLIST, marketplace UI) | Tickets / owners |

---

## 8. Actions after the workshop (template)

| Action | Owner | Due | Doc/code to update |
|--------|-------|-----|-------------------|
| Finalise Growth bundle (included vs add-on) | | | `pricing-plan.md`, marketplace seeds |
| Marketplace → 3 bundle cards | | | UI + `docs/marketplace-addons.md` |
| Update CHECKLIST with launch gates | | | `CHECKLIST.md` |
| Demo tenant for chosen vertical | | | `seed.sql` / demo script |
| Communicate “no per-tenant DB” in architecture | | | `tech-stack.md` (one paragraph) |

---

## 9. One-page summary for stakeholders

**Bantu Niaga** serves Malaysian businesses under ~**RM 5M/year** with a simple path: **Free → RM69 → RM139 → RM249**.  

We use **one secure shared database** (not one DB per shop) — standard for SaaS at our scale.  

**Payroll** and **deep inventory** stay **premium add-ons** so micro businesses are not forced to pay ERP prices.  

**Growth** must feel **complete** for a small kedai (staff, sales, leave, basic stock).  

We scale by **indexes, archiving, and Supabase tier upgrades** — not by splitting tenants until an enterprise pays for it.

---

*Last updated: 2026-07-08 · Next review: after team workshop or first 25 paying customers.*
