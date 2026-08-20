# Phase 1 GTM core — Design Spec

**Date:** 2026-08-20  
**Status:** Approved — implementation in progress on `feat/phase-1-gtm-core`  
**Plan:** `docs/superpowers/plans/2026-08-20-phase-1-gtm-core.md`  
**Source:** Sell-the-core audit + Phase 1 tracks A/B/C + tenant Bahasa (option 1) + soft-lock on unpaid (option A)

---

## 1. Problem

NiagaX’s six core modules are good enough to sell to Malaysian solo/micro SMEs, but commercial honesty is incomplete:

1. **Cash:** Plan changes can apply instantly via `settings_change_tier` without Billplz settlement. Renewal cron issues invoices; it does not charge. Dev Billplz bypass can grant paid behaviour when keys are missing.
2. **Catalogue:** Marketplace still surfaces many `is_coming_soon` SKUs. Buyers can confuse “planned” with “buyable.”
3. **Activation:** There is no product metric for “paid and did a real job in 7 days.”
4. **Language:** `preferred_locale` drives emails and Settings → Appearance, but the in-app tenant UI stays English.

Without fixing these, paid acquisition will create angry first customers and fake MRR.

---

## 2. Goals

| Track | Goal | Success criteria |
|-------|------|------------------|
| **A — Cash** | Collect real subscription money | Paid tier activates only after Billplz webhook confirms payment; renewals create bills that must be paid; production has no payment bypass |
| **A — Soft lock** | Protect revenue without hard logout | `past_due` → banner + block **create/mutate** for invoices, POS sales, and other write paths listed below; read/export still allowed |
| **B — Shelf** | Honest marketplace | Tenant marketplace shows only shipped / purchasable add-ons by default; onboarding does not upsell coming-soon SKUs |
| **C — Activation** | Prove first-week usage | Store first invoice / first POS timestamps; Home checklist; operator metric ≥40% of new paid activate in 7 days (target, not a code gate) |
| **D — Bahasa** | Full tenant app in `ms` | Every logged-in tenant surface + auth pages respect `preferred_locale`; missing keys fall back to English |

**North star (90 days):** 10–20 design partners pay, complete first invoice **or** POS within 7 days, and can run the tenant app in Bahasa Melayu.

Year-1 target of **80 paid** remains a business goal, not a Phase 1 engineering gate.

---

## 3. Non-goals (this pass)

- Super-admin UI translation (stays English)
- Public customer pages (`(public)/*` pay links), legal pages
- AI / Boardroom **reply body** translation (chrome may follow locale; model English)
- Invoice/marketing emails to the business’s *customers* (stay English unless a later spec)
- Full automated dunning (multi-retry email sequences, card updater flows) — Phase 1.5
- Hard lock / block login on unpaid
- MyInvois, payroll, WhatsApp API, TikTok, Shopee, hardware POS
- Changing list prices (Basic RM39 · Solo RM79 · Micro RM169 · Small RM299)
- Building new marketplace SKUs

---

## 4. Architecture overview

```
Owner picks paid plan
  → create subscription Billplz bill + pending invoice
  → redirect to Billplz
  → webhook (signed) → mark paid → apply/confirm tier + active
  → renewal cron → new bill when due; unpaid past grace → past_due
  → soft lock middleware / API guards until paid again

Marketplace load
  → filter !is_coming_soon AND isShippedMarketplaceAddon (default)
  → optional MARKETPLACE_SHOW_PLANNED for internal demos only

Activation
  → on first invoice send / first POS complete → set timestamps on business
  → Home checklist + super-admin activation %

Locale
  → preferred_locale (en|ms) → next-intl message catalogs
  → tenant shell + all (app) routes + auth pages
```

---

## 5. Track A — Live subscription collection + soft lock

### 5.1 Current behaviour (to replace for paid upgrades)

- `POST /api/settings/subscription/change` calls `settings_change_tier` immediately (demo / instant apply).
- `GET /api/cron/subscription-renewal` runs `subscription_process_renewals` (Free RM0 invoices + trial expiry); paid auto-charge is not live.
- Finance Billplz helpers already exist for invoice checkout and top-ups (`lib/finance/billplz-*`).

### 5.2 Target flows

#### Upgrade / convert (Free or trial → paid)

1. Owner selects Basic / Solo / Micro / Small (or Scale if offered).
2. API creates a **pending** subscription invoice + Billplz bill; does **not** flip paid tier to active until webhook.
3. Response returns `checkout_url`; client redirects.
4. Webhook verifies signature → completes invoice → sets `subscription_status = active`, updates `tier`, sets `subscription_renewal_at`.
5. If Billplz is not configured in **production**, fail closed with a clear error (no instant unlock, no credit/tier bypass).

#### Renewal

1. Cron finds businesses due for renewal (`subscription_renewal_at` ≤ now, paid tiers, status `active`).
2. Creates renewal invoice + Billplz bill; notifies owner (email using existing locale rules).
3. On paid webhook: extend `subscription_renewal_at`, keep `active`.
4. If unpaid after **grace period: 7 days after `subscription_renewal_at`**: set `subscription_status = past_due`. (Bill may be created on/before renewal day; the clock for soft lock is the renewal timestamp, not bill `created_at`.)

`past_due` already appears in super-admin types (`active` | `past_due` | `cancelled` | `trial`). Reuse it; do not invent a parallel enum.

#### Soft lock (`past_due`)

| Allowed | Blocked |
|---------|---------|
| Sign-in, read Home / lists / reports | Create/send invoice, create quote that implies receivable (if distinct) |
| Settings: billing, pay outstanding, profile, security | Complete POS sale / record sale |
| View customers, products, leave history | Activate paid marketplace add-ons / credit top-ups that require payment |
| Export / PDPA download | Tier upgrades that skip payment |
| Pay outstanding Billplz link | Destructive deletes that are not required for compliance (optional; prefer allow delete for PDPA) |

**UX:** Persistent banner on tenant shell: “Payment overdue — pay to continue creating invoices and sales.” CTA → Settings → Subscription / Billing with checkout link.

**Enforcement:** Shared server helper (e.g. `assertSubscriptionWritable(business)`) on mutating finance/sales/marketplace APIs; client disables primary create CTAs when status is `past_due`. Do not rely on UI alone.

**Trial:** Unpaid trial expiry continues to drop to Free per existing Basic-trial design; soft lock applies to **paid** `past_due`, not to Free.

**Free tier:** No soft lock for Free; Free remains write-capable within Free limits.

### 5.3 Production fail-closed

| Environment | Billplz missing |
|-------------|-----------------|
| Production / preview with production intent | Reject paid checkout / top-up / subscription charge; log securely; generic client error |
| Local / explicit test with bypass flag | Existing bypass allowed only when not production |

Remove or gate any path that grants credits or paid tier without a successful Billplz completion in production.

### 5.4 Out of scope for A (Phase 1.5)

- Automated multi-step dunning emails beyond the first “invoice due / past due” notice
- Card-on-file or Billplz auto-charge without owner clicking pay (if Billplz does not support it for this product, keep pay-link model)

---

## 6. Track B — Honest marketplace shelf

### 6.1 Default tenant catalogue

Show an add-on only if **both**:

1. `addon.is_coming_soon === false`
2. `isShippedMarketplaceAddon(slug)` is true (`lib/marketplace/shipped-addons.ts`)

Hide coming-soon cards from the main grid (not “Coming soon” buy tiles).

### 6.2 Planned features visibility

- Env `MARKETPLACE_SHOW_PLANNED=true`: optional internal/demo view of planned SKUs as **non-purchasable** waitlist teasers.
- Default for customers: **false** / unset.
- Footer or empty state: short copy + optional waitlist mailto / form (“Tell us what you need”) — no fake prices.

### 6.3 Onboarding

- Bundle / recommendation UI must not present coming-soon or unshipped slugs as included or purchasable.
- Prefer core module messaging (Admin, Finance, Ops, Sales, Marketing, HR) over marketplace catalogue.

### 6.4 Super-admin

- Super-admin may still edit `is_coming_soon` and catalogue rows (English). Unchanged visibility rules for operators.

---

## 7. Track C — First job + activation

### 7.1 Data

On `businesses` (or a small related table if preferred for clarity), persist:

| Field | Meaning |
|-------|---------|
| `first_invoice_sent_at` | First time a tenant invoice is sent / marked issued to a customer |
| `first_pos_sale_at` | First completed POS / sales receipt for the business |
| `activated_at` | `LEAST(first_invoice_sent_at, first_pos_sale_at)` when either is set (generated or maintained in app/RPC) |

Set each timestamp **once** (immutable after first write). Use existing invoice send / POS complete code paths; do not invent a separate “activation” product module.

### 7.2 Owner checklist (Home)

Visible until both optional items the business cares about are done, or until dismissed after activation:

1. Add a customer (or use existing)
2. Add a product (if Operations unlocked for tier) — skip if not in plan
3. **Send first invoice** or **complete first POS sale**
4. Optional: invite a team member

Checklist copy must be localised (Track D).

### 7.3 Operator metric

Super-admin (English): for businesses that became paid in a window, show:

- `% with activated_at within 7 days of paid start` (define paid start as first `active` paid subscription timestamp or `subscription_renewal_at` baseline — fix in implementation plan)
- List of unpaid-activated / stuck tenants

Target **≥40%** is an ops KPI, not a deploy blocker.

---

## 8. Track D — Tenant app Bahasa Melayu

### 8.1 Scope

| In locale | Out of locale |
|-----------|---------------|
| Sign-in, sign-up, complete, forgot/reset, verify-email, accept-invite | Super-admin |
| All `(app)/*` routes: Home, six pillars, Settings, Marketplace chrome, Boardroom chrome, onboarding | `(public)/*` customer pay pages |
| Shared nav, toasts, validation messages, empty states, soft-lock banner | Legal terms/privacy |
| Activation checklist | AI assistant / Boardroom **message body** |

Locale source: `public.users.preferred_locale` (`en` | `ms`), already set at signup and Settings → Appearance.

### 8.2 Approach

- Introduce **`next-intl`** with `messages/en.json` and `messages/ms.json`.
- Missing `ms` keys **fall back to English** so Tracks A–C can merge without waiting for 100% coverage.
- Prefer message keys over hardcoded strings in new/changed UI; migrate existing screens in pillar order:

  1. Shared shell + soft-lock banner + Home + checklist  
  2. Finance → Sales → Operations → Marketing → HR → Admin  
  3. Settings → Marketplace → Boardroom chrome  
  4. Auth pages  

### 8.3 Done definition for D

A user with `preferred_locale = ms` can: sign up/sign in, open Home, create/send an invoice **or** complete POS, open Settings (subscription/billing), and navigate all six modules **without English leftover on chrome and primary CTAs**. Secondary/rarely used strings may still fall back briefly during migration, but Phase 1 exit requires no English on the first-job path and Settings billing.

---

## 9. Security & AppSec notes

- Billplz webhook: verify `X-Signature` (or current Billplz scheme already used); never trust client-reported `paid`.
- Soft lock and tier changes: **server-side** authorization; BOLA — always scope by `business_id` from the authenticated session, never from client-supplied business id.
- No secrets in client bundles; Billplz keys stay server-only.
- Soft-lock banner and errors: generic user messages; detailed failures in server logs only.
- Marketplace activate / top-up: refuse when `past_due` or when add-on is coming soon / unshipped.

---

## 10. Sequencing

| Order | Work | Parallel? |
|-------|------|-----------|
| 1 | A: Billplz subscription checkout + webhook → active; remove instant paid tier flip in prod | Start first |
| 2 | A: Renewal bills + grace → `past_due` + soft lock | After checkout path exists |
| 3 | B: Filter marketplace + onboarding | Parallel with A |
| 4 | C: Timestamps + Home checklist + super-admin % | After or beside A |
| 5 | D: i18n plumbing + shell | Parallel once A started |
| 6 | D: Full tenant string migration | Continues through Phase 1 |

Do not block A on complete Bahasa coverage. Do not call Phase 1 “done” until A + B + C + D (tenant scope) meet success criteria in §2.

---

## 11. Testing (summary)

| Area | Coverage |
|------|----------|
| A | Unit: fail-closed without keys in production; webhook happy path; soft-lock helper allows read / blocks write |
| A | Integration: change plan → pending → webhook → active; unpaid renewal → past_due → write 402/403 |
| B | Marketplace load excludes coming soon; env flag shows teasers; activate rejects unshipped |
| C | First invoice/POS sets timestamps once; checklist visibility |
| D | Locale resolution from profile; ms strings for shell + finance/POS path; fallback for missing keys |

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Instant tier still used in demos | Gate instant apply behind non-production or explicit `ALLOW_INSTANT_TIER_CHANGE` |
| Soft lock too aggressive | Allow billing pay + settings + read; document allowed list in plan |
| Bahasa slows A/B/C | Plumbing + fallback; migrate first-job path first |
| Activation false negatives | Define “invoice sent” and “POS complete” against existing status fields in the plan |
| Partners on old instant-paid accounts | Grandfather: existing `active` paid stay; only new changes use Billplz |

---

## 13. Decisions locked

| Decision | Choice |
|----------|--------|
| Sell core now | Yes |
| Marketplace as GTM | No — hide unshipped |
| Bahasa in Phase 1 | Yes — **tenant app + auth only** |
| Unpaid renewal | **Soft lock** (read-only writes blocked; banner + pay CTA) |
| Super-admin / public pay / legal i18n | Out of scope |
| Payroll / MyInvois / WA API | Hold |

---

## 14. Open items for implementation plan (not blockers for this spec)

1. Whether Free→paid and trial→paid share one checkout helper with existing finance Billplz code.
2. Whether `activated_at` is a stored column or a maintained expression updated in the same write as the first timestamps.
3. Precise definition of “invoice sent” and “POS complete” against existing status enums in Finance/Sales.

---

## 15. Next step

After user approval of this spec:

1. Write `docs/superpowers/plans/2026-08-20-phase-1-gtm-core.md` (task breakdown for A→B→C→D).
2. Implement in sequenced PRs; do not mix full Bahasa dump with Billplz in one PR.
