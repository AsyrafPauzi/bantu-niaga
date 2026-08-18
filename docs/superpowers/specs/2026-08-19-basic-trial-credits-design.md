# 7-day Basic trial + credit expiry — Design Spec

**Date:** 2026-08-19  
**Status:** Approved for planning

---

## 1. Problem

Self-serve trial is a **14-day Solo (`micro`)** grant with **120** credits. When the trial ends, the business drops to Free but **leftover credits stay**. Sign-up and auth chrome still say “14-day Solo trial.” Product wants a shorter **Basic-only** trial, a small credit grant, and credits that die if they never pay.

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| Basic-only trial | New self-serve trial is `tier = basic`, `subscription_status = trial`, **7 days** |
| Trial credits | Grant **20** credits at trial start (not Basic’s monthly 60) |
| Expiry | Trial ends with no pay → Free (`starter` / `active`). Bundle credits → **0**. Purchased top-ups stay |
| Convert | Pay **any paid plan** during trial → leftover trial credits **kept**, then add that plan’s monthly bundle |
| Sign-up choice | Still **Free** and **7-day Basic trial** |
| Free upsell | Free businesses that have never used a self-serve trial see an in-app toolbar to start the same Basic trial |
| Grandfather | Existing `micro` + `trial` rows keep their current 14-day clock. When *those* trials end, use the new expiry (Free + wipe bundle credits) |
| Copy | UI says Basic / 7 days. Never “Solo trial” for this offer |

---

## 3. Non-goals (this pass)

- Card required to start trial
- A second trial after expiry
- Solo (or SME / Small) as a trial product
- Changing paid monthly bundles (Basic 60, Solo 120, SME 180, Small 360)
- Super-admin promo grants (§12 of `docs/pricing-plan.md`)
- Splitting trial credits into a new ledger table
- Native/mobile trial UX

---

## 4. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Trial product | Basic only |
| Length | 7 days |
| Trial grant | 20 credits |
| Subscribe during trial | Keep leftover trial credits, then grant the **chosen paid plan** bundle |
| Paid plans allowed | `basic`, `micro` (Solo), `sme`, `enterprise` — not Free |
| Sign-up | Both Free and 7-day Basic trial |
| Free later | Toolbar: start the same 7-day Basic trial, **once per business** |
| Existing Solo trials | Leave until they end; then Free + wipe bundle credits |
| Credit math on convert | Example: 15 left + Basic 60 = **75**; 15 left + Solo 120 = **135** |

---

## 5. User flow

```
Sign-up
  ├─ Free          → starter / active / 0 credits / toolbar eligible
  └─ Basic trial   → basic / trial / +20 / 7-day clock / toolbar never shown

Free + never used trial
  → toolbar “Try Basic for 7 days”
  → POST start-basic-trial
  → same as sign-up trial

During trial
  → Billing: switch to basic / micro / sme / enterprise
  → leftover credits stay
  → settings_change_tier grants that plan’s bundle on top
  → status active, 30-day paid cycle

Day 8, still trial
  → cron: starter / active / bundle credits 0 / keep top-ups
  → toolbar never shown again
```

Existing live Solo trials skip the new start path. They stay `micro` + `trial` until `subscription_renewal_at`. Expiry uses the same wipe rule.

---

## 6. Credits

Reuse `credit_balance` and `credit_topup_balance`. No new wallet.

| Event | Bundle (`credit_balance` minus top-up) | Top-up |
|-------|----------------------------------------|--------|
| Start Basic trial | Set/grant **+20** | Unchanged |
| Spend during trial | Decrements as today (bundle first) | Unchanged |
| Convert to paid | Leftover kept; **+** `tierBundledCredits(newTier)` | Unchanged |
| Trial expires | Bundle → **0** (`credit_balance = credit_topup_balance`) | Unchanged |
| Free sign-up | 0 | 0 |

`settings_change_tier` already sets `subscription_status = 'active'`, 30-day renewal, and grants the destination bundle **on top of** current balance. That is the convert path. Do not zero credits before that grant.

Trial start must **not** call `grantTierBundledCredits(..., "basic")` (that would be 60). Use a dedicated grant of **20** with reason `basic_trial_grant`.

---

## 7. Data

Add `public.businesses.self_serve_trial_used_at timestamptz null`.

Set it when:

- Owner provisions with `signup_path = starter_trial`
- Owner starts trial from the toolbar API

Backfill:

- Any row currently `subscription_status = 'trial'`
- Any row whose `audit_log` has `auth.sign_up` with `signup_path = starter_trial` or `trial_days > 0`

Toolbar and start-trial API require `self_serve_trial_used_at is null`. One trial per business.

Constants (app):

```
TRIAL_RENEWAL_DAYS = 7
BASIC_TRIAL_CREDITS = 20
```

`ownerProvisionPlan("starter_trial")`:

- `tier: "basic"`
- `subscriptionStatus: "trial"`
- `trialDays: 7`
- `grantCredits: true` but amount **20**, not Solo 120
- period label: `"7-day Basic trial"`

`ownerProvisionPlan("free")` unchanged (starter, 0 credits).

---

## 8. Expiry cron

Update `subscription_process_renewals` trial branch:

1. Invoice label: `"Trial ended"` (covers 7-day Basic and leftover 14-day Solo).
2. `tier = starter`, `subscription_status = active`, `renewal_at = now() + 30 days`.
3. `credit_balance = coalesce(credit_topup_balance, 0)` so unused trial/Solo bundle credits expire.
4. Do not grant Free credits.

Do **not** rewrite `subscription_renewal_at` for existing `micro` + `trial` rows at migrate time.

---

## 9. Toolbar (Free upsell)

SaaS app chrome (not standalone), owners (and whoever can change billing, if that is already owner-only):

**Show when:** `tier === "starter"` AND `subscription_status === "active"` AND `self_serve_trial_used_at is null`.

**Copy:** Try Basic for 7 days — 20 AI credits. CTA starts the trial. Secondary: dismiss for this browser (`localStorage`). Dismiss does not set `self_serve_trial_used_at`; the bar can return on another device until they start the trial or we later add a persist-dismiss. First pass: dismiss is session/localStorage only.

**Hide when:** trial used, currently on trial, or any paid tier.

**API:** `POST /api/settings/subscription/start-basic-trial`

- Session required. Same role as plan change (owner).
- Reject standalone (`403`).
- Reject if not `starter` + `active` or if `self_serve_trial_used_at` set (`409 trial_already_used` / `invalid_status`).
- Set `basic` + `trial` + `trialRenewalAt()` + grant 20 + stamp `self_serve_trial_used_at`.
- Issue RM0 subscription invoice period `"7-day Basic trial"`.
- Rate-limit like other billing POSTs.

No password. Email/Google complete forms keep the two cards: Free vs 7-day Basic trial.

---

## 10. Copy surfaces

Replace “14-day Solo trial” / “Start a 14-day trial” with **7-day Basic trial** on:

- `/sign-up`, `/sign-up/complete`, `/sign-up/guide`
- `/sign-in`, `/forgot-password` trial links
- Provision invoice period label
- Tests and `docs/pricing-plan.md` self-serve trial row

Quiz “starter_trial” still means this Basic trial (same enum, new product).

---

## 11. Security

- Start-trial and plan change: authenticated owner, own `business_id` only (existing BOLA pattern).
- Mass assignment: start-trial body empty or `.strict()` with no client-supplied credits/tier.
- Do not trust `user_metadata` for trial eligibility; use `businesses` columns.
- Credit wipe only on the trial expiry branch, not on paid renewal.
- Generic API errors; log details server-side.

---

## 12. Testing

- `ownerProvisionPlan("starter_trial")` → basic, 7 days, grant 20.
- Complete/sign-up grant 20, not 120.
- Convert from trial via `settings_change_tier` to basic / micro / sme / enterprise → leftover + bundle.
- Expiry: `credit_balance` becomes top-up only; tier starter.
- Grandfather: `micro` + `trial` with future `renewal_at` is not rewritten by migration.
- Start-trial: happy path; 409 if already used; 403 standalone; 401 unauthenticated.
- Toolbar hidden when `self_serve_trial_used_at` is set.

---

## 13. Key files

- `lib/settings/subscription-billing.ts` — `TRIAL_RENEWAL_DAYS = 7`
- `lib/auth/provision-owner-business.ts` — Basic + 20-credit grant
- `supabase/migrations/*_basic_trial.sql` — column, backfill, expiry wipe
- `app/api/settings/subscription/start-basic-trial/route.ts` — new
- App chrome banner component
- Sign-up / complete / guide / sign-in copy
- `docs/pricing-plan.md` §13
- Tests: provision, billing constants, expiry SQL or RPC test, start-trial API, change-tier leftover

---

*Decisions: trial product Basic (A); leftover + plan grant (A); grandfather existing Solo trials (A); keep Free + trial at sign-up (A); Free toolbar is Basic 7-day (A); convert target is any paid plan.*
