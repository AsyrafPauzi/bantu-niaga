# Marketing Strong (Solo+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Solo+ Marketing morning follow-up desk, one-tap WhatsApp with contact stamps, “not messaged in 30 days” segments, coupon clarity at POS/customer page, and import/merge polish — CTC only.

**Architecture:** Add `customers.last_contacted_at`; stamp via shared `touchCustomerLastContacted` from broadcast Mark sent and a new mark-contacted API used by one-tap WA. Pure helpers for EN/MS templates and desk buckets; extend segment rules with `not_contacted_days`. Reshape `MarketingOverview` first viewport into three panels. Coupon redemption list reads existing `coupon_redemptions`; POS gets clearer label/success cue. Import wizard copy/summary only.

**Tech Stack:** Next.js App Router, Supabase, Vitest, existing Marketing modules, CTC `wa.me` (same pattern as HR leave decision sheet).

**Spec:** `docs/superpowers/specs/2026-08-20-marketing-strong-design.md`

## Global Constraints

- Solo+ only (`micro` | `sme` | `enterprise`) — Marketing pillar already gated; no new Marketplace SKU.
- No WhatsApp Business API — CTC `wa.me` only; optimistic stamp on Open WhatsApp is intentional.
- No birthday / DOB; no `/marketing/follow-ups` route; no merge-inbox product.
- No new desk aggregate tables — query + pure partition helpers, cap ~20 rows/panel.
- Prefer TDD: failing Vitest → implement → pass → commit per task.
- Branch: `feat/marketing-strong-core` (off `feat/hr-strong-core`).

## File map

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260820140000_customers_last_contacted.sql` | `last_contacted_at` + index |
| `lib/marketing/last-contacted.ts` | `touchCustomerLastContacted` |
| `app/api/marketing/customers/[id]/mark-contacted/route.ts` | POST stamp endpoint |
| `app/api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent/route.ts` | Also touch customer |
| `lib/marketing/follow-up-messages.ts` | EN/MS templates + `waMeUrl` |
| `components/marketing/FollowUpWhatsAppSheet.tsx` | Copy EN/MS + Open WhatsApp |
| `lib/marketing/segments-rules.ts` | `not_contacted_days` rule |
| `lib/marketing/follow-up-desk.ts` | Pure bucket helpers |
| `lib/marketing/dashboard-queries.ts` / overview load | Desk panel rows |
| `components/marketing/MarketingFollowUpDesk.tsx` | Three panels UI |
| `components/marketing/MarketingOverview.tsx` | Mount desk above fold |
| `components/marketing/CustomerDetail*.tsx` | One-tap WA sheet |
| `components/sales/PosCheckoutClient.tsx` | Coupon label + success cue |
| `components/marketing/CustomerCouponHistory.tsx` | Redemptions list |
| `components/marketing/CsvImportWizardPencil.tsx` | Preview counts / merge CTA clarity |
| `docs/CHECKLIST.md` | §8 + §12d |

---

### Task 1: `last_contacted_at` migration + touch helper

**Files:**
- Create: `supabase/migrations/20260820140000_customers_last_contacted.sql`
- Create: `lib/marketing/last-contacted.ts`
- Create: `tests/marketing/last-contacted.test.ts`

**Interfaces:**
- Produces:
```ts
export async function touchCustomerLastContacted(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  at?: Date,
): Promise<void>;
```
- Consumes: `customers` update scoped by `business_id` + live row (`deleted_at` / `merged_into_id` null)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { touchCustomerLastContacted } from "@/lib/marketing/last-contacted";

describe("touchCustomerLastContacted", () => {
  it("updates last_contacted_at for the business-scoped customer", async () => {
    const eq = vi.fn().mockReturnThis();
    const is = vi.fn().mockReturnThis();
    const update = vi.fn().mockReturnValue({
      eq,
      is,
      then: undefined,
    });
    // Prefer a chain mock that resolves { error: null } at the end —
    // match patterns in tests/marketing/* for supabase stubs.
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
              })),
            })),
          })),
        })),
      })),
    };
    await touchCustomerLastContacted(
      supabase as never,
      "biz-1",
      "cust-1",
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(supabase.from).toHaveBeenCalledWith("customers");
  });
});
```

(Adapt mock style to whatever the repo’s marketing tests already use for Supabase chains.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/marketing/last-contacted.test.ts`  
Expected: FAIL — module missing

- [ ] **Step 3: Migration**

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS customers_business_last_contacted_idx
  ON public.customers (business_id, last_contacted_at)
  WHERE deleted_at IS NULL AND merged_into_id IS NULL;
```

- [ ] **Step 4: Implement helper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function touchCustomerLastContacted(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  at: Date = new Date(),
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ last_contacted_at: at.toISOString() })
    .eq("business_id", businessId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .is("merged_into_id", null);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Run tests — PASS; apply migration when ready**

Run: `npx vitest run tests/marketing/last-contacted.test.ts`  
Run: `npm run supabase:migrate` (or project equivalent) when DB available.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260820140000_customers_last_contacted.sql \
  lib/marketing/last-contacted.ts tests/marketing/last-contacted.test.ts
git commit -m "feat(marketing): add customers.last_contacted_at and touch helper"
```

---

### Task 2: Mark-contacted API + Mark-sent stamp

**Files:**
- Create: `app/api/marketing/customers/[id]/mark-contacted/route.ts`
- Modify: `app/api/marketing/broadcasts/[id]/recipients/[rid]/mark-sent/route.ts`
- Create: `tests/marketing/mark-contacted-route.test.ts` (or extend existing API test style)

**Interfaces:**
- Produces: `POST /api/marketing/customers/[id]/mark-contacted` → `{ ok: true, last_contacted_at }`
- Consumes: `getCurrentUser`, `canSurface(..., "marketing", "customers")`, `touchCustomerLastContacted`
- Mark-sent: select `customer_id` on recipient; after successful sent update, call touch (best-effort log on failure — do not fail Mark sent if touch fails; prefer fail-closed only if easy — **prefer fail-soft**: try/catch touch, still return ok for mark-sent)

- [ ] **Step 1: Implement mark-contacted route**

Authorize like other customer routes. Validate UUID. Call `touchCustomerLastContacted`. Return 404 if update matched 0 rows (optional: re-select). Return 200 `{ ok: true, last_contacted_at: iso }`.

- [ ] **Step 2: Wire mark-sent**

In mark-sent route, expand recipient select to include `customer_id`. After recipient status → `sent`, if `customer_id` present:

```ts
try {
  await touchCustomerLastContacted(supabase, user.businessId, customerId);
} catch {
  // fail-soft: mark-sent already succeeded
}
```

Use the RLS-scoped `supabase` client (not service role) for the customers update so tenant scope holds. If RLS blocks service-only patterns, use service role with explicit `business_id` filter — match AppSec: never trust client `businessId` from body.

- [ ] **Step 3: Unit/integration test for route auth + happy path** (mock getCurrentUser + supabase)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(marketing): stamp last_contacted on mark-sent and mark-contacted API"
```

---

### Task 3: Follow-up WhatsApp templates + sheet

**Files:**
- Create: `lib/marketing/follow-up-messages.ts`
- Create: `tests/marketing/follow-up-messages.test.ts`
- Create: `components/marketing/FollowUpWhatsAppSheet.tsx`

**Interfaces:**
```ts
export type FollowUpReason = "dormant" | "no_purchase" | "check_in";

export function buildFollowUpMessages(input: {
  reason: FollowUpReason;
  customerName: string;
  businessName?: string;
}): { en: string; ms: string };

export function waMeUrl(phoneE164: string, text: string): string;
```

- [ ] **Step 1: Failing unit test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildFollowUpMessages,
  waMeUrl,
} from "@/lib/marketing/follow-up-messages";

describe("buildFollowUpMessages", () => {
  it("builds EN/MS without IC numbers", () => {
    const m = buildFollowUpMessages({
      reason: "dormant",
      customerName: "Aina",
      businessName: "Kedai Mira",
    });
    expect(m.en).toMatch(/Aina/);
    expect(m.ms).toMatch(/Aina/);
    expect(m.en + m.ms).not.toMatch(/\d{12}/);
  });
});

describe("waMeUrl", () => {
  it("strips non-digits", () => {
    expect(waMeUrl("+60 12-345 6789", "hi")).toContain("wa.me/60123456789");
  });
});
```

- [ ] **Step 2: Implement templates**

Reason intent:
- `dormant` — win-back / miss you  
- `no_purchase` — invite first visit / offer help  
- `check_in` — friendly check-in (profile default)

- [ ] **Step 3: Sheet component**

Mirror `components/hr/HrLeaveDecisionSheet.tsx`: dialog with Copy EN, Copy MS, Open WhatsApp (or “Add phone first”). Props: `open`, `onClose`, `reason`, `customerName`, `phoneE164`, `businessName?`, `preferredLocale?`, `customerId`, `onOpenedWhatsApp?`.

On Open WhatsApp click:
1. `await fetch(/api/marketing/customers/${id}/mark-contacted, { method: "POST" })` (fire-and-forget ok if network fails — still open WA)
2. Navigate to `waMeUrl(phone, primaryText)` via `window.open` or `<a target=_blank>`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(marketing): follow-up WhatsApp EN/MS templates and sheet"
```

---

### Task 4: Segment rule `not_contacted_days`

**Files:**
- Modify: `lib/marketing/segments-rules.ts`
- Modify: `tests/marketing/segments-rules.test.ts`

**Interfaces:**
- Extend `SegmentRulesSchema` with `not_contacted_days: z.number().int().positive().optional()`
- Update `isEmptyRules`, `compileRulesToSql`, `applyRulesToCustomersQuery`

SQL / filter semantics (match `inactive_days` style):

```
(last_contacted_at IS NULL OR last_contacted_at < now() - interval 'N days')
```

For supabase-js: `.or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoffIso}`)` — verify PostgREST `or` syntax used elsewhere in this file and copy that pattern.

- [ ] **Step 1: Extend failing tests** for null last_contacted and stale vs fresh

- [ ] **Step 2: Implement schema + SQL + query mutator**

- [ ] **Step 3: Ensure segment create UI can pass the field** if there is a rules form — if only JSON/advanced, document preset rules object `{ "not_contacted_days": 30 }` in CHECKLIST later; if UI has inactive_days input, add sibling field “Not contacted (days)”.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(marketing): segment rule not_contacted_days for last_contacted_at"
```

---

### Task 5: Follow-up desk pure helpers + loader

**Files:**
- Create: `lib/marketing/follow-up-desk.ts`
- Create: `tests/marketing/follow-up-desk.test.ts`
- Modify: `lib/marketing/dashboard-queries.ts` (or new `lib/marketing/follow-up-desk-load.ts`)
- Modify: `app/(app)/marketing/page.tsx` to pass desk props

**Interfaces:**
```ts
export type FollowUpDeskRow = {
  id: string;
  name: string;
  phone_e164: string | null;
  reason: FollowUpReason; // panel reason
};

export function partitionFollowUpDesk(
  customers: ReadonlyArray<{
    id: string;
    name: string;
    phone_e164: string | null;
    order_count: number | null;
    last_purchase_at: string | null;
    last_contacted_at: string | null;
    auto_tags: string[] | null;
  }>,
  opts: { now: Date; notContactedDays: number; limit: number },
): {
  dormant: FollowUpDeskRow[];
  noPurchase: FollowUpDeskRow[];
  notMessaged: FollowUpDeskRow[];
};
```

Membership:
- **dormant:** `auto_tags` includes `dormant` OR `at-risk` (match repo hyphen), has phone  
- **noPurchase:** `(order_count ?? 0) === 0` and `!last_purchase_at`, has phone  
- **notMessaged:** phone and (`!last_contacted_at` or older than N days)

A customer may appear in multiple arrays. Cap each to `limit` (20).

Prefer loading with 2–3 targeted queries (dormant tag filter, no purchase filter, not contacted filter) instead of pulling entire CRM — keep under ~100 rows scanned if possible.

- [ ] **Step 1: Unit tests for partition**

- [ ] **Step 2: Implement helpers + `loadFollowUpDesk(businessId)`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(marketing): follow-up desk partition helpers and loader"
```

---

### Task 6: Overview three-panel UI

**Files:**
- Create: `components/marketing/MarketingFollowUpDesk.tsx`
- Modify: `components/marketing/MarketingOverview.tsx`
- Modify: `app/(app)/marketing/page.tsx`
- Modify: `messages/en.json` + `messages/ms.json` (keys under `marketing.desk*`) if overview uses i18n; otherwise English-first matching existing overview tone

**Interfaces:**
- Desk receives three arrays + `businessName?` + `preferredLocale?`
- Each row button opens `FollowUpWhatsAppSheet` with panel reason

- [ ] **Step 1: Build three equal panels** above hero stats / competing clutter — first viewport = desk (same priority as HR Strong)

- [ ] **Step 2: Wire page loader data into `MarketingOverview` or sibling above it**

- [ ] **Step 3: Empty states** — one short line per panel (“No dormant customers”)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(marketing): owner follow-up desk with three morning panels"
```

---

### Task 7: Customer profile one-tap WhatsApp

**Files:**
- Modify: `components/marketing/CustomerDetailDesktopView.tsx`
- Modify: `components/marketing/CustomerDetailMobileView.tsx`

Replace bare `https://wa.me/${digits}` with button that opens `FollowUpWhatsAppSheet` reason=`check_in`. Keep tel: link as-is.

- [ ] **Step 1: Wire sheet on both desktop and mobile**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(marketing): one-tap WhatsApp sheet on customer profile"
```

---

### Task 8: Coupon clarity (POS + customer history)

**Files:**
- Modify: `components/sales/PosCheckoutClient.tsx`
- Create: `components/marketing/CustomerCouponHistory.tsx`
- Modify: `app/(app)/marketing/customers/[id]/page.tsx` (+ desktop/mobile views)
- Possibly: `lib/marketing/coupon-redemptions-load.ts` — list by customer

**Interfaces:**
```ts
export type CustomerCouponRedemption = {
  id: string;
  code: string;
  discount_amount_myr: number;
  redeemed_at: string;
};
```

Query:
```ts
.from("coupon_redemptions")
.select("id, discount_amount_myr, redeemed_at, coupons!inner(code, business_id)")
.eq("customer_id", customerId)
// ensure business via coupons.business_id = user.businessId
.order("redeemed_at", { ascending: false })
.limit(20)
```

(Adjust join syntax to match existing coupon queries.)

- [ ] **Step 1: POS** — helper text under coupon input: “Coupon code from Marketing”; on successful checkout when coupon applied, show inline success (`Coupon {CODE} · −RM X`) using existing response fields if present, else derive from client state.

- [ ] **Step 2: Customer page** — section “Coupons redeemed” with empty “No coupons yet.”

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(marketing): coupon clarity at POS and customer redemption history"
```

---

### Task 9: Import / merge polish

**Files:**
- Modify: `components/marketing/CsvImportWizardPencil.tsx`
- Verify: `components/marketing/CustomerForm.tsx` / `MergePromptBanner` still surfaces merge on duplicate phone create

**Scope hard stop:** UI/copy only — no new APIs or merge inbox.

- [ ] **Step 1:** Preview step — prominent summary strip: `Create {n} · Merge {n} · Reject {n}` (use existing `preview.summary`)

- [ ] **Step 2:** Duplicate reject rows — reason text includes clear “Duplicate phone — use merge on customer profile or re-import as merge” when status is duplicate; ensure merge-classified rows stay `status: "merge"` with existing CTA language

- [ ] **Step 3:** Commit only if code changed

```bash
git commit -m "fix(marketing): clarify CSV import create/merge/reject summary"
```

---

### Task 10: Docs + checklist

**Files:**
- Modify: `docs/CHECKLIST.md` (§8.1 + new §12d Marketing Strong)
- Modify: `docs/superpowers/specs/2026-08-20-marketing-strong-design.md` status → Implemented (when code done)
- Fix stale “Pro (enterprise)” → Solo+ in §8 header if still present

- [ ] **Step 1: Checklist items** for desk, last_contacted, WA sheet, coupon history, import polish

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: mark Marketing Strong shipped items in checklist"
```

---

### Task 11: Verification + PR

- [ ] **Step 1:**  
`npx vitest run tests/marketing/last-contacted.test.ts tests/marketing/follow-up-messages.test.ts tests/marketing/follow-up-desk.test.ts tests/marketing/segments-rules.test.ts`

- [ ] **Step 2:** `npx tsc --noEmit`

- [ ] **Step 3:** Manual smoke (Solo+): `/marketing` three panels → Open WhatsApp → `last_contacted_at` set; Mark sent on broadcast stamps; segment with `not_contacted_days: 30`; POS coupon helper; customer redemptions; import preview counts.

- [ ] **Step 4:** Push `feat/marketing-strong-core` and open PR titled `feat: Marketing Strong — follow-up desk + contact stamps`  
Base: `feat/hr-strong-core` (or `main` once HR is merged).

---

## Spec coverage checklist

| Spec section | Task(s) |
|--------------|---------|
| §5 last_contacted + stamps | 1, 2 |
| §6 Follow-up desk | 5, 6 |
| §7 One-tap WA | 3, 6, 7 |
| §5.3 / §2 segment | 4 |
| §8 Coupons | 8 |
| §9 Import | 9 |
| §11 Testing | embedded + 11 |
| §12 Docs | 10 |
| Non-goals (birthday, WA API, follow-ups route) | — |

## Placeholder scan

No TBD/TODO left in tasks; signatures named for neighboring tasks.
