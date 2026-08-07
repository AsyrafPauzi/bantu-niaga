# Year 1 Revenue & Gross Profit Forecast (Middle Ground + Basic)

> **Status:** Planning model — not accounting. **Salaries excluded.** Profit here = **revenue minus COGS** (infrastructure + variable usage + payment processing).
>
> **Pricing basis:** [`pricing-plan.md`](./pricing-plan.md) — **Basic RM39**, Solo **RM79**, Micro **RM169**, Small **RM299**, Scale **RM429** (optional). Free **200 MB** storage.
>
> **Last updated:** 2026-08-07

---

## 1. What this model includes

| Included in revenue | Included in COGS | Excluded |
|---------------------|------------------|----------|
| Subscription MRR (monthly + annual billing) | Vercel, Supabase, Resend, domain/monitoring | Salaries, contractors, marketing spend |
| Add-on MRR (scaled ~50% cheaper — higher stack rate) | Variable AI inference (bundled + top-ups) | Office, legal, accounting |
| AI credit top-ups (one-time, RM10/100 packs) | Email sends (Resend) | Corporate tax, SST remittance |
| | Storage egress, payment gateway fees | Past development cost |
| Super-admin **promo months** (e.g. Solo 3 mo free) | Free-tier usage (200 MB, no AI) | |

**Profit definition:** **Gross profit** = collected revenue − COGS. Contribution before labour — not full company profitability.

---

## 2. Key assumptions (base case)

| Assumption | Base-case input |
|------------|-----------------|
| **Paid customers at month 12** | **80** (linear ramp from launch) |
| **Average paid customers (year)** | **43** (sum of monthly counts ÷ 12) |
| **Free users at month 12** | **240** (~3:1 free:paid) |
| **Tier mix (paid)** | **28% Basic** · **50% Solo** · **18% Micro** · **6% Small** · **2% Scale** |
| **Billing mix** | 85% monthly · 15% annual (2 months free) |
| **MSME Madani grant** | 25% of Micro customers on annual → ~50% off year 1 (Micro only) |
| **Add-on uplift** | **RM7 / paid / month** (~1.5 stacked add-ons at scaled prices) |
| **Credit top-up uplift** | **RM1.5 / paid / month** (RM10/100 packs; ~10% buy quarterly) |
| **Campaign promos** | **3% revenue haircut** — super-admin Solo **3 months free** (~5% of cohort) |
| **Churn** | 0% (Year 1 launch — replace after month 6) |
| **Collection** | 100% of invoiced subscription collected (see risk §9) |

**Why more Basic in Year 1:** Freelancer entry at RM39 + roadshow promos on Solo pull acquisition; Solo+ mix rises in Year 2 as shops add stock/HR.

---

## 3. Blended net ARPU (cash per paid customer / month)

### 3.1 Subscription net price (before payment fees)

| Tier | List monthly | Annual effective / mo | Net blend (85% / 15%) |
|------|-------------|------------------------|------------------------|
| **Basic** | RM39 | RM32.50 | **RM38.0** |
| Solo | RM79 | RM65.83 | **RM77.0** |
| Micro | RM169 | RM140.83 | **RM164.8** → **RM141.3** blended (Madani on 25% of Micro) |
| Small | RM299 | RM249.17 | **RM291.5** |
| Scale | RM429 | RM357.50 | **RM418.3** |

**Madani:** 18% of paid on Micro × 25% on grant at RM70.8/mo vs RM164.8.

**Tier-mix subscription ARPU:**

| Tier | Mix | Net price | Weighted |
|------|-----|-----------|----------|
| Basic | 28% | RM38.0 | RM10.64 |
| Solo | 50% | RM77.0 | RM38.50 |
| Micro | 18% | RM141.3 | RM25.43 |
| Small | 6% | RM291.5 | RM17.49 |
| Scale | 2% | RM418.3 | RM8.37 |
| **Subscription blend** | | | **RM100.4** |

### 3.2 Total cash ARPU

| Component | RM / paid / month |
|-----------|-------------------|
| Subscription (tier mix + Madani) | 100.4 |
| Recurring add-ons (scaled catalog, ~1.5 SKUs) | 7.0 |
| AI credit top-ups (blended) | 1.5 |
| **Gross cash ARPU** | **108.9** |
| Campaign promo haircut (§2) | −3.3 |
| **Effective cash ARPU** | **~105.6** |

**Basic stack example:** RM39 plan + recurring invoices (RM9) + booking page (RM9) = **RM57/mo** — still below many accounting-only tools.

Payment processing (COGS, not ARPU): ~2.2% of revenue + RM1.25 FPX per monthly charge.

### 3.3 Basic tier unit economics

| Item | Basic RM39 | Solo RM79 |
|------|------------|-------------|
| Bundled credits | 60 (Mini 3.3 only) | 120 (Mini + deep mode) |
| Typical AI COGS | ~RM1.50/mo | ~RM2.50/mo |
| Storage quota | 1 GB | 5 GB |
| Target AI COGS % MRR | **&lt;10%** at p75 | **&lt;15%** at p75 |
| Upgrade lever | +RM40/mo → Solo (3 more modules + 3 agents) | +RM90/mo → Micro |

---

## 4. Monthly revenue bridge (base case)

Linear paid ramp: month *m* paid ≈ **80 × m ÷ 12**. Effective ARPU **RM105.6** (after promo haircut).

| Month | Paid | Est. MRR | Cumulative revenue |
|------:|-----:|---------:|-------------------:|
| 1 | 7 | RM739 | RM739 |
| 2 | 13 | RM1,373 | RM2,092 |
| 3 | 20 | RM2,112 | RM4,200 |
| 4 | 27 | RM2,851 | RM7,051 |
| 5 | 33 | RM3,485 | RM10,536 |
| 6 | 40 | RM4,224 | RM14,760 |
| 7 | 47 | RM4,963 | RM19,703 |
| 8 | 53 | RM5,597 | RM25,300 |
| 9 | 60 | RM6,336 | RM31,636 |
| 10 | 67 | RM7,075 | RM38,711 |
| 11 | 73 | RM7,709 | RM46,000 |
| 12 | 80 | RM8,448 | **RM54,448** |

**Year 1 total revenue (base):** **RM54,448**

Checkpoint notes:
- Month 6: ~40 paid, ~RM4,224 MRR — Basic + Solo-heavy mix.
- Month 12: ~80 paid, ~RM8,448 MRR — includes ~28% Basic freelancers.

**Paid-months in Year 1:** **520** (sum of monthly paid counts).

---

## 5. COGS model

### 5.1 Fixed infrastructure (platform)

| Period | Paid range | Fixed infra RM/mo | Basis |
|--------|------------|-------------------|--------|
| Months 1–3 | 0–20 | **RM15** | Supabase/Vercel free tiers + domain |
| Months 4–6 | 20–40 | **RM150** | Vercel Pro + Supabase Pro |
| Months 7–12 | 40–80 | **RM250** | Pro stack + Resend Pro |

**Year 1 fixed infra:** 3×15 + 3×150 + 6×250 = **RM1,995**

**Conservative allowance:** **RM4,800/year** (RM400/mo flat).

### 5.2 Variable COGS per paid customer

Blended by tier mix (Basic lower — Mini 3.3 only, 60 credits, 1 GB):

| Tier | Variable / paid / month | Mix | Weighted |
|------|-------------------------|-----|----------|
| Basic | RM1.95 (AI RM1.50 + email RM0.30 + storage RM0.15) | 28% | RM0.55 |
| Solo+ | RM3.50 | 72% | RM2.52 |
| **Blended** | | | **RM3.07** |

**Variable COGS (paid):** 520 × RM3.07 = **RM1,596**

### 5.3 Free-tier variable COGS

Free: Finance lite — no AI, max 25 emails/mo, **200 MB** storage (lower than prior 2 GB model).

| Assumption | Value |
|------------|--------|
| Average free users through year | 60 (ramp 0 → 240) |
| Variable / free / month | **RM0.35** |
| **Free-tier COGS** | 60 × 12 × 0.35 = **RM252** |

### 5.4 Payment processing

| Item | Calculation | Year 1 |
|------|-------------|--------|
| Gateway % (2.2% blended) | 54,448 × 0.022 | RM1,198 |
| Billplz FPX (RM1.25 × paid-months) | 520 × 1.25 | RM650 |
| **Payment COGS** | | **RM1,848** |

### 5.5 COGS summary

| COGS line | Realistic ramp | Conservative |
|-----------|----------------|--------------|
| Fixed infrastructure | RM1,995 | RM4,800 |
| Variable (paid) | RM1,596 | RM1,596 |
| Variable (free) | RM252 | RM350 |
| Payment processing | RM1,848 | RM1,848 |
| **Total COGS** | **RM5,691** | **RM8,594** |

---

## 6. Year 1 profit summary (base case)

| Metric | Realistic COGS | Conservative COGS |
|--------|----------------|-------------------|
| **Total revenue** | RM54,448 | RM54,448 |
| **Total COGS** | RM5,691 | RM8,594 |
| **Gross profit** | **RM48,657** | **RM45,854** |
| **Gross margin** | **89.4%** | **84.2%** |
| Gross profit / paid-month | RM93.5 | RM88.2 |

**Infrastructure-only break-even (Growth stage):** fixed ~RM250/mo ÷ (effective ARPU − variable − payment) ≈ **3 paid customers**.

**Interpretation:** Adding Basic **lowers headline ARPU** vs Solo-only ladder but **raises acquisition** and **addon stack revenue**. Gross profit stays strongly positive before salaries. Campaign **free months** are modeled as revenue haircut, not removed COGS — promo tenants still consume infra.

---

## 7. Scenario range (Year 1)

| Scenario | M12 paid | Avg paid | Revenue | COGS (realistic) | Gross profit |
|----------|----------|----------|---------|----------------|--------------|
| **Conservative** | 50 | 27 | RM33,800 | RM4,200 | **RM29,600** |
| **Base** | 80 | 43 | RM54,448 | RM5,691 | **RM48,657** |
| **Upside** | 120 | 63 | RM81,200 | RM7,400 | **RM73,800** |

Conservative: 22% Basic mix, RM5 add-on uplift, 5% promo haircut. Upside: 32% Basic, RM9 add-on stack, faster ramp to 120 paid.

---

## 8. Revenue mix (base case, Year 1)

| Source | Est. annual | % of revenue |
|--------|-------------|--------------|
| **Basic** subscriptions | RM14,600 | 27% |
| Solo subscriptions | RM19,900 | 37% |
| Micro subscriptions | RM13,500 | 25% |
| Small + Scale subscriptions | RM5,900 | 11% |
| Add-ons (recurring, scaled prices) | RM3,640 | 7% |
| AI credit top-ups | RM780 | 1% |
| Email overflow packs | ~RM130 | &lt;1% |

**Upgrade levers:**
- Basic → Solo: **+RM40/mo** subscription (+3 modules, +3 agents, Boardroom).
- Solo → Micro: **+RM90/mo** subscription.
- Addon stack on Basic (3 SKUs): **+RM27/mo** at scaled prices.

---

## 9. Risks & model gaps

| Risk | Impact on forecast |
|------|-------------------|
| **Invoices ≠ collected cash** | Revenue overstated until Billplz settlement is source of truth |
| **Campaign promos** | Super-admin **3 mo Solo free** — if &gt;10% of cohort, revenue −3–8% |
| **Basic cannibalizes Solo** | More Basic without addon stack lowers ARPU; monitor Basic→Solo conversion |
| **Churn not modeled** | Net revenue lower if monthly churn &gt; 3% |
| **Heavy AI / email users** | Variable COGS rises on Solo+; Basic capped by Mini-only + 60 credits |
| **Free tier (200 MB)** | Lower COGS than prior 2 GB model; abuse still low cost per user |
| **Madani grant uptake** | Higher grant % lowers Micro cash ARPU |
| **Cheaper add-ons** | Uplift assumes higher stack rate — validate attach rate in month 3–6 |

Replace assumptions with `business_usage_monthly`, `ai_usage`, promo tables, and payment settlement logs after **month 3–6**.

---

## 10. Comparison across pricing iterations

| Metric | RM89 credible tier | Middle ground (no Basic) | **With Basic RM39** |
|--------|-------------------|--------------------------|---------------------|
| Blended net ARPU | ~RM108 | ~RM119 | **~RM106** (effective) |
| Year 1 revenue (80 M12 paid) | ~RM54,400 | ~RM62,100 | **~RM54,400** |
| Year 1 COGS (realistic) | ~RM6,800 | ~RM6,500 | **~RM5,700** |
| Year 1 gross profit | ~RM47,600 | ~RM55,400 | **~RM48,700** |
| Free storage COGS | Higher (2 GB) | Higher (2 GB) | **Lower (200 MB)** |

**Net effect:** Basic **reduces blended ARPU** ~12% vs Solo-only ladder but **improves freelancer acquisition**, **addon stacking**, and **lowers variable COGS** on the entry tier. Year 1 gross profit is **similar to RM89-era model** with **lower paid count risk** (easier RM39 conversion).

---

## 11. Related documents

- [`pricing-plan.md`](./pricing-plan.md) — Basic, storage quotas, scaled add-ons, super-admin promos
- [`architecture/tech-stack.md`](./architecture/tech-stack.md) — infra stage costs
- [`architecture/super-admin.md`](./architecture/super-admin.md) — platform admin provisioning
- Economics canvas (Cursor): `canvases/bantu-niaga-three-year-economics.canvas.tsx` — update for Basic + scaled add-ons

---

## Document history

| Date | Change |
|------|--------|
| 2026-08-07 | Initial Year 1 forecast from middle-ground pricing plan; salaries excluded |
| 2026-08-07 | **Basic RM39** tier (28% mix), Free 200 MB, scaled add-ons (+RM7 uplift), promo haircut, lower Basic COGS |
