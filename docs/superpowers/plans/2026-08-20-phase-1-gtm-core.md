# Phase 1 GTM Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NiagaX honest to sell: live Billplz subscription cash + soft lock, hide unshipped marketplace, first-week activation metric, and full tenant-app Bahasa Melayu.

**Architecture:** Extend the existing top-up Billplz pattern (`settings_create_topup_pending` → webhook → `settings_complete_topup_billplz`) to paid tier changes and renewals. Soft-lock writes when `subscription_status = past_due`. Filter marketplace via shipped + `!is_coming_soon`. Stamp activation on first invoice send / POS checkout. Add `next-intl` driven by `users.preferred_locale` for tenant + auth only.

**Tech Stack:** Next.js 15 App Router, Supabase (RPC + migrations), Billplz, Vitest, `next-intl`, existing Zod/API patterns.

**Spec:** `docs/superpowers/specs/2026-08-20-phase-1-gtm-core-design.md`

## Global Constraints

- Paid tier becomes `active` only after Billplz webhook confirms payment (except RM0 Free / promo / trial start paths that remain RM0).
- Production: no Billplz bypass for paid checkout or credit top-up.
- Soft lock on `past_due`: allow read + billing pay + settings; block invoice send / POS checkout / paid marketplace activates.
- Grace: `past_due` when unpaid **7 days after `subscription_renewal_at`**.
- Marketplace default: show only `!is_coming_soon` **and** `isShippedMarketplaceAddon(slug)`.
- Bahasa: tenant `(app)/*` + auth pages only. Super-admin, `(public)/*`, legal stay English. AI reply bodies stay English.
- Missing `ms` keys fall back to English.
- Server-side enforcement for soft lock and payment; never trust client-only UI.
- Commits only when the user asks, unless they chose an execution mode that includes commits.
- Prefer separate PRs per track: A → B → C → D (B may parallel A).

## Spec open items — locked in this plan

| Item | Decision |
|------|----------|
| Checkout helper | New `lib/settings/subscription-checkout.ts` mirroring top-up + finance Billplz patterns; webhook extends `completeBillplzPayment` with `kind: "subscription"` |
| `activated_at` | Stored column on `businesses`, set once when first of invoice/POS timestamps is written |
| “Invoice sent” | `POST /api/finance/invoices/[id]/send` success, or PATCH that sets finance invoice `status` to `sent` |
| “POS complete” | Successful `POST /api/sales/pos/checkout` |

## File map

| File | Role |
|------|------|
| `lib/settings/subscription-writable.ts` | Soft-lock guard |
| `lib/settings/subscription-checkout.ts` | Create Billplz bill + pending subscription invoice |
| `lib/settings/require-billplz-prod.ts` | Fail-closed in production |
| `app/api/settings/subscription/change/route.ts` | Paid → checkout URL; RM0 → instant |
| `app/api/webhooks/billplz/route.ts` + `lib/finance/billplz-checkout.ts` | Complete subscription payment |
| `app/api/cron/subscription-renewal/route.ts` + SQL RPC | Renewal bills + mark `past_due` |
| `components/settings/PastDueBanner.tsx` | Soft-lock banner |
| `lib/marketplace/load.ts` + `MarketplaceView` / onboarding | Honest shelf |
| Migration: activation columns | `first_invoice_sent_at`, `first_pos_sale_at`, `activated_at` |
| Finance send + POS checkout | Stamp activation |
| `components/home/ActivationChecklist.tsx` | Owner first-job UI |
| Super-admin activation metric | Operator % |
| `next-intl` messages + providers | Tenant Bahasa |

---

### Task 1: Soft-lock writable helper

**Files:**
- Create: `lib/settings/subscription-writable.ts`
- Create: `tests/settings/subscription-writable.test.ts`

**Interfaces:**
- Consumes: `subscription_status` string from `businesses`
- Produces: `isSubscriptionWritable(status: string): boolean`, `assertSubscriptionWritable(status: string): void` (throws `SubscriptionPastDueError`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  SubscriptionPastDueError,
  assertSubscriptionWritable,
  isSubscriptionWritable,
} from "@/lib/settings/subscription-writable";

describe("subscription writable", () => {
  it("allows active, trial, and cancelled for reads but writable only active+trial", () => {
    expect(isSubscriptionWritable("active")).toBe(true);
    expect(isSubscriptionWritable("trial")).toBe(true);
    expect(isSubscriptionWritable("past_due")).toBe(false);
    expect(isSubscriptionWritable("cancelled")).toBe(false);
  });

  it("assert throws SubscriptionPastDueError on past_due", () => {
    expect(() => assertSubscriptionWritable("past_due")).toThrow(
      SubscriptionPastDueError,
    );
    expect(() => assertSubscriptionWritable("active")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npx vitest run tests/settings/subscription-writable.test.ts`

- [ ] **Step 3: Implement**

```ts
export class SubscriptionPastDueError extends Error {
  readonly code = "subscription_past_due" as const;
  constructor(message = "Payment overdue. Pay to continue creating invoices and sales.") {
    super(message);
    this.name = "SubscriptionPastDueError";
  }
}

/** Mutating finance/sales/marketplace actions allowed when true. */
export function isSubscriptionWritable(status: string): boolean {
  return status === "active" || status === "trial";
}

export function assertSubscriptionWritable(status: string): void {
  if (!isSubscriptionWritable(status)) {
    throw new SubscriptionPastDueError();
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/settings/subscription-writable.test.ts`

---

### Task 2: Production Billplz fail-closed helper

**Files:**
- Create: `lib/settings/require-billplz-prod.ts`
- Create: `tests/settings/require-billplz-prod.test.ts`
- Modify: `lib/env/production-checks.ts` — Billplz hint: required for paid GTM (keep check reporting; update hint text)
- Modify: `app/api/settings/billing/topup/route.ts` — refuse bypass when `NODE_ENV === "production"`

**Interfaces:**
- Produces: `assertBillplzConfiguredForPaidCheckout(): void` throws if production and `!isBillplzConfigured()`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertBillplzConfiguredForPaidCheckout } from "@/lib/settings/require-billplz-prod";

describe("assertBillplzConfiguredForPaidCheckout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when Billplz env missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLPLZ_API_KEY", "");
    vi.stubEnv("BILLPLZ_COLLECTION_ID", "");
    expect(() => assertBillplzConfiguredForPaidCheckout()).toThrow(
      /billplz_not_configured/i,
    );
  });

  it("allows non-production without keys", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BILLPLZ_API_KEY", "");
    expect(() => assertBillplzConfiguredForPaidCheckout()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/settings/require-billplz-prod.test.ts`

- [ ] **Step 3: Implement helper**

```ts
import { isBillplzConfigured } from "@/lib/settings/billing";

export class BillplzNotConfiguredError extends Error {
  readonly code = "billplz_not_configured" as const;
  constructor() {
    super("Billplz is not configured for paid checkout.");
    this.name = "BillplzNotConfiguredError";
  }
}

/** Production must have Billplz for any paid money path. */
export function assertBillplzConfiguredForPaidCheckout(): void {
  if (process.env.NODE_ENV === "production" && !isBillplzConfigured()) {
    throw new BillplzNotConfiguredError();
  }
}
```

At the start of the top-up route’s non-Billplz branch (the `settings_topup_credits` bypass), call:

```ts
if (process.env.NODE_ENV === "production") {
  return NextResponse.json(
    { error: "billplz_not_configured", message: "Payment is not available." },
    { status: 503 },
  );
}
```

Update `production-checks.ts` Billplz hint to: `"Required for paid subscription and top-up in production. No bypass."`

- [ ] **Step 4: Run tests — PASS**

Run: `npx vitest run tests/settings/require-billplz-prod.test.ts`

---

### Task 3: Pending subscription invoice + Billplz checkout (upgrade path)

**Files:**
- Create: `supabase/migrations/20260820100000_subscription_billplz_checkout.sql`
- Create: `lib/settings/subscription-checkout.ts`
- Create: `tests/settings/subscription-checkout.test.ts` (pure helpers: amount, description)
- Modify: `app/api/settings/subscription/change/route.ts`
- Modify: `lib/settings/subscription-billing.ts` — export helpers used by checkout

**Behaviour:**
- Target tier with `tierAmountMyr(tier) === 0` OR active promo RM0 → keep instant `settings_change_tier` (unchanged semantics for Free).
- Paid amount > 0 → do **not** call `settings_change_tier` yet. Create pending `public.invoices` row (`status = pending`, `kind = subscription`), Billplz bill, intent row linking `billplz_id` → invoice + `pending_tier`.
- Return `{ checkout_url, pending: true, billplz_id, invoice_id }`.
- Call `assertBillplzConfiguredForPaidCheckout()` before creating a paid bill; in production missing keys → 503.

**SQL sketch (new migration):**

```sql
-- Intent table for subscription (platform invoices), parallel to top-up pending.
create table if not exists public.subscription_billplz_intents (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  pending_tier text not null,
  billplz_id text not null,
  billplz_url text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists subscription_billplz_intents_billplz_id_idx
  on public.subscription_billplz_intents (billplz_id);

-- settings_create_subscription_pending(...)
-- inserts invoices with status 'pending', paid_at null, amount = tier price,
-- inserts intent with pending_tier, returns invoice_id + intent_id.

-- settings_complete_subscription_billplz(p_billplz_id text)
-- marks invoice paid, sets businesses.tier = pending_tier, subscription_status = active,
-- subscription_renewal_at = now() + 30 days, grants monthly credits per existing tier rules,
-- marks intent completed. Idempotent if already completed.
```

Mirror credit/grant logic already inside current `settings_change_tier` for the paid path — prefer calling a slimmed RPC `settings_apply_paid_tier(p_business_id, p_tier, p_user_id)` from the complete function so renewals and upgrades share one apply path.

- [ ] **Step 1: Write unit tests for checkout description / amount**

```ts
import { describe, expect, it } from "vitest";
import { tierAmountMyr } from "@/lib/settings/subscription-billing";
import { subscriptionBillDescription } from "@/lib/settings/subscription-checkout";

describe("subscription checkout helpers", () => {
  it("prices match list", () => {
    expect(tierAmountMyr("basic")).toBe(39);
    expect(tierAmountMyr("micro")).toBe(79);
  });

  it("builds bill description", () => {
    expect(subscriptionBillDescription("basic")).toMatch(/Basic/i);
  });
});
```

- [ ] **Step 2: Implement `subscription-checkout.ts` + migration + change route**

`POST /api/settings/subscription/change` outline:

```ts
// after parse + owner check
assertBillplzConfiguredForPaidCheckout(); // only matters when amount > 0 and NODE_ENV=production

const amount = tierAmountMyr(parsed.tier);
if (amount <= 0) {
  // existing settings_change_tier instant path
  ...
  return NextResponse.json({ tier, subscription_status, pending: false });
}

const checkout = await startSubscriptionCheckout({
  supabase,
  businessId: user.businessId,
  userId: user.id,
  pendingTier: parsed.tier,
  amountMyr: amount,
});
return NextResponse.json({ ...checkout, pending: true }, { status: 201 });
```

Wire UI on Settings → Subscription to redirect to `checkout_url` when `pending: true` (same pattern as top-up).

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run tests/settings/subscription-checkout.test.ts`

- [ ] **Step 4: Manually smoke locally** (when Billplz sandbox keys present): change Free → Basic → receive URL; without keys in development, document temporary behaviour (503 in prod only).

---

### Task 4: Webhook completes subscription payment

**Files:**
- Modify: `lib/finance/billplz-checkout.ts` — try `settings_complete_subscription_billplz` after finance/topup (or before topup if bill id matches subscription intents)
- Modify: `app/api/webhooks/billplz/route.ts` — handle `kind: "subscription"`
- Create: `tests/settings/subscription-billplz-complete.test.ts` — mock RPC order if pure function extracted

**Interfaces:**
- Extends `completeBillplzPayment` return: `{ kind: "finance" | "topup" | "subscription", businessId, ... }`

- [ ] **Step 1: Extend `completeBillplzPayment`**

After existing finance RPC miss / topup miss, call:

```ts
const subRes = await client.rpc("settings_complete_subscription_billplz", {
  p_billplz_id: billplzId,
});
// if row returned → kind: "subscription"
```

- [ ] **Step 2: Webhook** — on subscription kind, return `{ ok: true, kind: "subscription" }` (no finance `dispatchInvoicePaid`).

- [ ] **Step 3: Test** — unit-test a small pure “classify completion” helper if extraction helps; otherwise integration smoke with mocked supabase client.

---

### Task 5: Renewal bills + mark past_due

**Files:**
- Modify: SQL via new migration `20260820110000_subscription_renewal_past_due.sql` — update `subscription_process_renewals`
- Modify: `app/api/cron/subscription-renewal/route.ts` — optionally create Billplz bills for pending renewal invoices (or do bill creation inside a TS loop after RPC returns pending invoice ids)

**Behaviour:**
1. For paid `active` businesses with `subscription_renewal_at <= now()`: issue **pending** subscription invoice (not auto-`paid`), keep status `active` during grace.
2. Cron or follow-up job creates Billplz bill + intent for each pending renewal invoice missing an intent (reuse `startSubscriptionCheckout` with `pendingTier = current tier`).
3. Email owner payment link (use existing locale email rules).
4. If `subscription_renewal_at + 7 days < now()` and latest subscription invoice still `pending`: set `subscription_status = past_due`.
5. On webhook pay while `past_due` or `active`: apply renewal (`subscription_renewal_at += 30 days`, status `active`).

Free / trial expiry paths from Basic-trial design stay as they are.

- [ ] **Step 1: Add SQL function `subscription_mark_past_due()`** that updates qualifying rows; call from cron after renewals.

- [ ] **Step 2: Cron route** calls mark-past-due RPC and returns counts `{ renewed, bills_created, past_due_marked }`.

- [ ] **Step 3: Document in `docs/CHECKLIST.md`**: Billplz subscription live settlement ✅ when done.

---

### Task 6: Soft-lock banner + API guards

**Files:**
- Create: `components/settings/PastDueBanner.tsx`
- Modify: `app/(app)/layout.tsx` — load `subscription_status`; pass to shell / render banner
- Modify: `app/api/finance/invoices/[id]/send/route.ts`
- Modify: `app/api/finance/invoices/route.ts` (create when status sent)
- Modify: `app/api/finance/invoices/[id]/route.ts` (PATCH to sent)
- Modify: `app/api/sales/pos/checkout/route.ts`
- Modify: marketplace activate / top-up routes (paid) — reject `past_due`
- Create: `tests/settings/past-due-api-guard.test.ts` (helper mapping HTTP 402)

**HTTP:** on `SubscriptionPastDueError` return **402** with `{ error: "subscription_past_due", message }`.

- [ ] **Step 1: Banner component** (English keys first; Task 12 wraps i18n):

```tsx
export function PastDueBanner({ checkoutHref }: { checkoutHref: string }) {
  return (
    <div role="alert" className="...">
      <p>Payment overdue — pay to continue creating invoices and sales.</p>
      <a href={checkoutHref}>Pay now</a>
    </div>
  );
}
```

- [ ] **Step 2: In each mutating route**, after `getCurrentUser`, load `subscription_status` for `user.businessId` and `assertSubscriptionWritable`.

- [ ] **Step 3: Tests** for a thin `pastDueResponse(err)` helper.

---

### Task 7: Honest marketplace shelf

**Files:**
- Modify: `lib/marketplace/load.ts` — filter after fetch (or `.in("slug", SHIPPED...)` + `is_coming_soon = false`) unless `process.env.MARKETPLACE_SHOW_PLANNED === "true"`
- Modify: `components/marketplace/MarketplaceView.tsx` — defensive filter; empty state copy
- Create: `tests/marketplace/catalog-filter.test.ts`
- Create: `lib/marketplace/catalog-filter.ts`

**Interfaces:**
- Produces: `filterTenantCatalog(entries, { showPlanned: boolean }): CatalogEntry[]`

```ts
import { isShippedMarketplaceAddon } from "@/lib/marketplace/shipped-addons";
import type { CatalogEntry } from "@/lib/marketplace/types";

export function filterTenantCatalog(
  entries: CatalogEntry[],
  opts: { showPlanned: boolean },
): CatalogEntry[] {
  if (opts.showPlanned) {
    return entries; // teasers still non-purchasable via existing is_coming_soon UI
  }
  return entries.filter(
    (e) =>
      !e.addon.is_coming_soon && isShippedMarketplaceAddon(e.addon.slug),
  );
}
```

- [ ] **Step 1: Tests** for filter include/exclude.
- [ ] **Step 2: Wire `loadCatalog`** to apply filter when `MARKETPLACE_SHOW_PLANNED` is not `"true"`.
- [ ] **Step 3: Empty state** — “More add-ons coming. Tell us what you need.” + mailto `support@…` or existing contact — no fake prices.

---

### Task 8: Onboarding does not upsell coming-soon

**Files:**
- Modify: `lib/onboarding/business-bundles.ts`
- Modify: `app/(app)/onboarding/recommendation/page.tsx` (and related components)
- Modify: `tests/onboarding/business-bundles.test.ts`

- [ ] **Step 1: Extend tests** — coming-soon / unshipped lines never appear as purchasable recommendations.
- [ ] **Step 2: Filter** recommendation lines with `isShippedMarketplaceAddon` and `!is_coming_soon`.
- [ ] **Step 3: Run** `npx vitest run tests/onboarding/business-bundles.test.ts`

---

### Task 9: Activation columns + stamp on first job

**Files:**
- Create: `supabase/migrations/20260820120000_business_activation.sql`
- Create: `lib/settings/activation.ts`
- Create: `tests/settings/activation.test.ts`
- Modify: `app/api/finance/invoices/[id]/send/route.ts`
- Modify: `app/api/finance/invoices/[id]/route.ts` (when status becomes `sent`)
- Modify: `app/api/sales/pos/checkout/route.ts`

**Migration:**

```sql
alter table public.businesses
  add column if not exists first_invoice_sent_at timestamptz,
  add column if not exists first_pos_sale_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists first_paid_at timestamptz;

-- RPC: business_touch_activation(p_business_id, p_kind text)
-- p_kind in ('invoice','pos')
-- sets first_* only if null; sets activated_at = coalesce(activated_at, now()) when either first_* becomes set
```

```ts
export async function touchActivation(
  supabase: SupabaseClient,
  businessId: string,
  kind: "invoice" | "pos",
): Promise<void> {
  const { error } = await supabase.rpc("business_touch_activation", {
    p_business_id: businessId,
    p_kind: kind,
  });
  if (error) throw new Error(error.message);
}
```

Call after successful invoice send / POS checkout (do not fail the main request if activation RPC fails — log and continue).

- [ ] **Step 1: Unit-test** pure helper that computes whether activated if you extract one; else test RPC via SQL comments + smoke.
- [ ] **Step 2: Wire call sites.**

---

### Task 10: Home checklist + super-admin activation %

**Files:**
- Create: `components/home/ActivationChecklist.tsx`
- Modify: Home page loader under `app/(app)/home/`
- Modify: `lib/super-admin/load.ts` (+ types) — compute `% activated within 7 days of paid start`
- Modify: a super-admin dashboard card (investor-metrics or businesses page)

**Paid start for metric:** `coalesce(activated_at window start, subscription_renewal_at - 30 days)` is messy. Use: businesses that transitioned to paid in the last 30 days via audit `billing.subscription_invoice` / tier change audit, **or** simpler Phase 1: among businesses with `tier != 'starter'` and `subscription_status in ('active','past_due')`, `% where activated_at is not null and activated_at <= first_paid_at + 7 days`. Store `first_paid_at` on business when subscription first becomes paid active (set in `settings_complete_subscription_billplz` and grandfather: `coalesce(first_paid_at, created_at)` for existing).

Add column `first_paid_at` in Task 9 migration (already listed). Set it in `settings_complete_subscription_billplz` when first becoming paid `active`. Grandfather existing paid: backfill `first_paid_at = coalesce(first_paid_at, created_at)` for `tier != 'starter'`.

Checklist items:
1. Has ≥1 customer (query count)
2. Has ≥1 product if ops unlocked else skip
3. `first_invoice_sent_at || first_pos_sale_at`
4. Optional team invite

Hide checklist when item 3 is done (or `activated_at` set).

---

### Task 11: next-intl plumbing

**Files:**
- `npm install next-intl`
- Create: `messages/en.json`, `messages/ms.json` (minimal shell keys)
- Create: `lib/i18n/request.ts`, `lib/i18n/routing.ts` (locale from user profile, not URL prefix — **profile-driven**, keep existing routes)
- Modify: `app/(app)/layout.tsx` and auth layouts to wrap `NextIntlClientProvider` with messages for `preferred_locale`
- Create: `tests/i18n/locale-messages.test.ts` — every key in `en.json` exists (ms may fall back via next-intl config)

**Approach (important):** Do **not** introduce `/ms/...` URL prefixes in Phase 1. Resolve locale server-side from `users.preferred_locale` and pass messages into providers. Client components use `useTranslations`.

Minimal `en.json`:

```json
{
  "shell": {
    "pastDueBanner": "Payment overdue — pay to continue creating invoices and sales.",
    "pastDueCta": "Pay now"
  },
  "activation": {
    "title": "Get your business running",
    "sendInvoiceOrPos": "Send your first invoice or complete a POS sale"
  }
}
```

`ms.json` with Malay equivalents.

- [ ] **Step 1: Install + provider wire on `(app)/layout.tsx`.**
- [ ] **Step 2: Test** that `en` and `ms` JSON parse and required keys exist in both for shell+activation.

---

### Task 12: Localise shell, soft-lock, Home, activation

**Files:**
- Modify: `PastDueBanner`, `ActivationChecklist`, adaptive shell nav labels (desktop + mobile), Home page copy
- Expand `messages/en.json` + `messages/ms.json`

- [ ] **Step 1: Replace hardcoded banner/checklist strings with `t('...')`.**
- [ ] **Step 2: Nav pillar labels via messages.**
- [ ] **Step 3: Spot-check** with `preferred_locale=ms` in Settings → Appearance.

---

### Task 13: Localise Finance + Sales first-job path

**Files:** Finance invoice list/new/send UI, Sales POS page, shared buttons (Save, Send, Pay).
**Messages:** `finance.*`, `sales.*` namespaces.

- [ ] **Step 1: Extract user-visible strings on invoice create/send and POS checkout into messages.**
- [ ] **Step 2: Malay translations for those keys.**
- [ ] **Step 3: Manual path:** ms user creates invoice or POS without English primary CTAs.

---

### Task 14: Localise remaining tenant modules (wave)

**Files (migrate systematically):**
- Operations: products, stock, orders, bookings
- Marketing: customers, segments, coupons, broadcasts chrome
- HR: employees, leave, holidays, me portal
- Admin: tasks, documents, compliance
- Settings: all settings pages including subscription/billing
- Marketplace chrome (shipped list)
- Boardroom chrome (not AI body)
- Auth: sign-in, sign-up, complete, forgot/reset, verify-email, accept-invite

**Process per pillar:**
1. Add keys to `en.json`
2. Add `ms.json` translations
3. Replace literals in components
4. Smoke that pillar in `ms`

Do not translate super-admin or `(public)/*`.

**Exit criteria for Phase 1 D:** Bahasa owner can sign in, use Home checklist, send invoice or POS, open Settings → Subscription, and navigate all six pillars without English leftover on primary chrome/CTAs.

---

### Task 15: Docs + checklist sync

**Files:**
- Modify: `docs/CHECKLIST.md` — Billplz subscription live, soft lock, marketplace filter, activation, tenant i18n
- Modify: `docs/superpowers/specs/2026-08-20-phase-1-gtm-core-design.md` status if needed → `Implemented` when all tracks land

---

## Self-review (plan vs spec)

| Spec requirement | Task(s) |
|------------------|---------|
| Billplz before paid tier | 3, 4 |
| Renewal + grace 7d after `subscription_renewal_at` → `past_due` | 5 |
| Soft lock writes | 1, 6 |
| Production fail-closed | 2 |
| Hide unshipped marketplace | 7 |
| Onboarding no coming-soon upsell | 8 |
| Activation timestamps + checklist + operator % | 9, 10 |
| Tenant + auth Bahasa via next-intl | 11–14 |
| Non-goals (super-admin i18n, MyInvois, hard lock, full dunning) | Excluded |

---

## Execution notes

- Prefer **one PR per track** (A = Tasks 1–6, B = 7–8, C = 9–10, D = 11–14, docs = 15).
- Track D is largest; ship Task 11–13 before finishing Task 14 so design partners get soft-lock + first-job Bahasa early.
- Apply migrations with the repo’s usual `npm run supabase:migrate` / linked push — never invent ad-hoc prod SQL outside migrations.
