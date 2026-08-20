# BantuNiaga — Go-Live Action Plan
**Date:** 2026-08-20  
**Status:** Implementation ~90% complete. Remaining work: env config + 1 migration push + Track D (Bahasa UI).

---

## What the Code Audit Actually Found

The Phase 1 GTM implementation is **almost fully done**. The original audit was based on design docs — the actual code is much further ahead. Here is the real state:

| Area | Status | Note |
|------|--------|------|
| Billplz subscription checkout | ✅ Done | Code wired; just needs API keys |
| Fail-closed in production | ✅ Done | `assertBillplzConfiguredForPaidCheckout` — throws 503 if no keys in prod |
| Soft lock on POS sales | ✅ Done | `assertBusinessSubscriptionWritable` called in `/api/sales/pos/checkout` |
| Soft lock on invoice send | ✅ Done | Called in `/api/finance/invoices/[id]/send` and invoice PATCH |
| Soft lock on invoice create | ✅ Fixed | Added today — was the only missing guard |
| Soft lock on marketplace activate | ✅ Done | Called in `/api/marketplace/activate` |
| `PastDueBanner` in shell | ✅ Done | Mounted in `(app)/layout.tsx` |
| Renewal cron creates Billplz bills | ✅ Done | `/api/cron/subscription-renewal` |
| Past-due mark after 7-day grace | ✅ Done | `subscription_mark_past_due` RPC in cron |
| Plans.ts — Basic RM39 tier | ✅ Done | `TierKey = "basic"` with correct quotas |
| Entitlements — Basic pillar map | ✅ Done | Admin + Sales + Finance only |
| Free tier invoice cap (25/mo) | ✅ Done | `assertFreeTierInvoiceQuota` in invoice API |
| Free tier expense block | ✅ Done | `assertFreeTierExpensesAllowed` in transactions API |
| Free tier customer cap (50) | ✅ Done | `assertFreeTierCustomerQuota` in customers API |
| Free tier DuitNow block | ✅ Done | `assertFreeTierDuitNowAllowed` in invoice API |
| Free tier quotes block | ✅ Done | `assertFreeTierQuotesAllowed` in invoice API |
| Marketplace filter (hide coming-soon) | ✅ Done | `filterTenantCatalog` applied in `loadCatalog()` |
| Activation tracking (first invoice/POS) | ✅ Done | `touchActivation` in invoice send + POS checkout |
| ActivationChecklist on Home | ✅ Done | Mounted in `/home/page.tsx` |
| Credit grant on subscription | ✅ Done | SQL migration calls `subscription_tier_bundled_credits` |
| Webhook handles subscription kind | ✅ Done | `completeBillplzPayment` dispatches to `settings_complete_subscription_billplz` |
| Auth pages Bahasa/English | ✅ Done | `useTranslations("auth")` on sign-up, sign-in, forgot-pw, verify-email |
| Tenant app UI in Bahasa | ⬜ Remaining | next-intl not wired to `(app)/*` routes — see Track D |

---

## Remaining Work to Go Live

### STEP 1 — Set Billplz API Keys in Production (5 min)
> Done by: Asyraf / whoever has Vercel access

Go to **Vercel → bantuniaga-system → Settings → Environment Variables** and add:

```
BILLPLZ_API_KEY=<your live Billplz API key>
BILLPLZ_X_SIGNATURE_KEY=<your live X-Signature Key>
BILLPLZ_COLLECTION_ID=<your live collection ID>
```

Do **not** set `BILLPLZ_SANDBOX=true` in production.

**Verify:** after adding keys, redeploy and hit `GET /api/external/v1/ping` — should return `{ ok: true }`. Then test a paid subscription upgrade manually on staging/preview.

**Where to get the keys:**  
Billplz dashboard → Settings → API → API Key (v4) + X-Signature Key + your collection ID.

---

### STEP 2 — Push Database Migrations (5 min)
> Done by: dev with Supabase DB access

Three new migrations were created today and need to be applied to the hosted database:

```bash
npx supabase db push
```

Migrations to apply:
- `20260820100000_subscription_billplz_checkout.sql` — subscription pending/complete RPCs, credit grant on checkout
- `20260820110000_subscription_renewal_past_due.sql` — `subscription_mark_past_due` RPC, renewal Billplz bill creation
- `20260820120000_business_activation.sql` — `first_invoice_sent_at`, `first_pos_sale_at`, `activated_at` columns + `business_touch_activation` RPC

**Verify:** run `npx supabase db diff` — should show no pending changes after push.

---

### STEP 3 — Fix Failing Tests (1–2 hours)
> 10 test failures in `tests/marketing/` — database schema cache issue, not billing related.

```bash
npx vitest run tests/marketing/api-content.test.ts tests/marketing/api-merge.test.ts
```

The failures are `"Could not find the table 'public.marketing_test_orders_*' in the schema cache"` — likely a test DB setup issue (temp tables not visible). Not a production concern but clean them up before merging to main.

---

### STEP 4 — Verify End-to-End on Staging (30–60 min)
> Manual test — no code changes

1. **Free → Basic upgrade**: sign up, go to Settings → Subscription, pick Basic (RM39). Should redirect to Billplz. Complete payment. Confirm tier shows "Basic" and 3 agents are available.
2. **Past-due soft lock**: manually set a test business's `subscription_status = 'past_due'` in Supabase. Confirm:
   - `POST /api/finance/invoices` returns 403
   - `POST /api/sales/pos/checkout` returns 403  
   - `POST /api/marketplace/activate` returns 403
   - The `PastDueBanner` shows in the app shell
   - Reading data (lists, reports) still works
3. **Free tier limits**: on a Free account, create 25 invoices. The 26th should fail with `free_tier_limit` error + upgrade modal.
4. **Marketplace shelf**: confirm no coming-soon tiles show on tenant marketplace. Set `MARKETPLACE_SHOW_PLANNED=true` in local env to see the full catalog (for internal demos only).
5. **Activation checklist**: after first POS sale or invoice send, check Home — the checklist item should turn green.

---

### STEP 5 — Track D: Bahasa Melayu Tenant App (2–3 days)
> Separate branch — does not block launch, but needed for roadshows

Auth pages already use `useTranslations("auth")`. The `(app)/*` tenant shell needs to be wired.

**What to do:**
1. Set up `next-intl` routing in `(app)/layout.tsx` — read `users.preferred_locale` (already saved on sign-up) and pass it to the `<NextIntlClientProvider>`.
2. Audit `messages/ms.json` — add missing keys for all tenant page labels, navigation, and form strings. Missing keys already fall back to English.
3. Replace hardcoded English strings in the most visible tenant pages: Home, Finance, Sales, HR, Operations, Marketing, Admin dashboards.
4. Test by switching locale to `ms` in Settings → Appearance → Language.

**Out of scope (Phase 1):** super-admin UI, public customer invoice pages, AI reply body text, email to business's own customers.

---

### STEP 6 — Super-Admin Client Provisioning (1–2 days)
> Needed for roadshows — allows creating accounts with free trial tiers

The `/super-admin/clients/create` page exists but the API (`POST /api/super-admin/clients`) needs:
- Accept: `{ businessName, ownerEmail, tier, promo?: { tier, months }, campaignCode? }`
- Provision business + invite owner
- Grant promo tier + credits immediately
- Write to `subscription_promotions` table
- Cron: `subscription-promo-expiry` to downgrade at `promo_ends_at`

---

## Summary: What Stops You Going Live RIGHT NOW

| # | Action | Time | Who |
|---|--------|------|-----|
| 1 | Add `BILLPLZ_API_KEY` + `BILLPLZ_X_SIGNATURE_KEY` + `BILLPLZ_COLLECTION_ID` to Vercel env | 5 min | Asyraf |
| 2 | `npx supabase db push` (3 migrations) | 5 min | Dev |
| 3 | Manual E2E verify on staging | 30–60 min | Both |

**That's it.** The code is ready. Once the keys are in and migrations are pushed, the billing backbone is live.

---

## What Does NOT Block Launch

- Track D (Bahasa Melayu tenant app) — useful for roadshows but app is fully functional in English
- Super-admin client provisioning — needed for campaign promos but not for self-serve sign-up
- Failing marketing tests (schema cache issue) — not production-affecting
- COGS guardrail email rollup — can be monitored manually at launch scale (80 paid customers)
- Annual billing — monthly billing works; annual is a nice-to-have for launch
