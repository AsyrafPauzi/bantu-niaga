# Marketing Strong (Solo+) — Design Spec

**Date:** 2026-08-20  
**Status:** Implemented  
**Plan:** `docs/superpowers/plans/2026-08-20-marketing-strong.md`  
**Branch:** `feat/marketing-strong-core` (off `feat/hr-strong-core`)  
**Predecessor:** HR Strong — `docs/superpowers/specs/2026-08-20-hr-strong-design.md`  
**Source:** Product memo — Marketing/HR “Strong” upgrades; shipping choice **B** (HR first, Marketing second); scope **C** (P0 + P1 + P2); birthday **A** (skip DOB); contact stamp **B** (Mark sent + one-tap WA); desk **A** (three panels on `/marketing`); WA content **A** (fixed EN/MS templates); architecture approach **1** (desk + touchpoints)

---

## 1. Problem

Solo+ (`micro` / `sme` / `enterprise`) unlocks Marketing, and core CRM / broadcasts / coupons / purchase-based dormant tags already ship — but owners still chase customers in WhatsApp and Excel because:

1. **Profile WhatsApp is empty CTC** — `wa.me` opens with no prefilled message; broadcast Mark-sent is the only structured path.
2. **No morning follow-up desk** — dormant / no-purchase / “not messaged” signals are not a clear first viewport on `/marketing`.
3. **No `last_contacted`** — cannot segment “not messaged in 30 days”; Sales leads have `last_contacted_at`, customers do not.
4. **Coupon habit is incomplete** — POS can redeem, but the cue is easy to miss and the customer page shows no redemption history.
5. **Import / merge friction** — create/merge/reject exists, but duplicate and merge outcomes need clearer polish (no merge-inbox product).

---

## 2. Goals

| Priority | Goal | Success criteria |
|----------|------|------------------|
| **P0** | Contact stamps | `customers.last_contacted_at` updates on broadcast Mark sent and one-tap WhatsApp open |
| **P0** | One-tap WhatsApp | CRM / desk / (cheap) segment rows open EN/MS template sheet + `wa.me` when phone exists |
| **P0** | Not-messaged segment | Rule `not_contacted_days` (default 30) usable in segments |
| **P1** | Follow-up desk | `/marketing` first viewport = three panels: Dormant · No purchase · Not messaged 30d |
| **P1** | Coupon clarity | Clearer POS coupon field/helper + success cue; customer page lists redemptions |
| **P2** | Import / merge polish | Wizard shows clearer create/merge/reject counts; duplicate phone always offers merge path |

**North star:** A Solo owner opens `/marketing` each morning, taps WhatsApp on the right people, and coupons stay visible at POS and on the customer file — still CTC-only (no WhatsApp Business API).

---

## 3. Non-goals (this PR)

- Birthday / DOB fields or birthday follow-up queue (deferred).
- WhatsApp Business API / automatic send without CTC.
- Dedicated `/marketing/follow-ups` route (rejected — reshape `/marketing` instead).
- New merge-inbox / duplicate resolution product (polish existing wizard only).
- Loyalty engines, Meta ads, email marketing redesign.
- HR Strong changes (already shipped / separate PR).

---

## 4. Decisions locked

| Topic | Choice |
|-------|--------|
| Scope | **C** — P0 + P1 + P2 in this PR |
| Birthday | **A** — skip this PR |
| `last_contacted` writers | **B** — Mark sent + one-tap WA open (optimistic CTC) |
| Follow-up surface | **A** — three panels on `/marketing` overview |
| One-tap message | **A** — fixed EN/MS templates by reason |
| Architecture | **1** — desk + touchpoints (not segment-only, not full follow-ups product) |

---

## 5. Data model & contact stamps

### 5.1 Column

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS customers_business_last_contacted_idx
  ON public.customers (business_id, last_contacted_at)
  WHERE deleted_at IS NULL AND merged_into_id IS NULL;
```

(Adjust RLS / soft-delete predicates to match existing `customers` indexes.)

### 5.2 Write paths

Shared helper (server): `touchCustomerLastContacted(supabase, businessId, customerId)`.

| Trigger | Behaviour |
|---------|-----------|
| Broadcast recipient **Mark sent** | Existing API also calls touch |
| One-tap WhatsApp open | `POST /api/marketing/customers/[id]/mark-contacted` (auth + business ownership) then client opens `wa.me` |

**Not stamped:** email broadcast delivery alone (unless product later adds open tracking), invoice send, POS sale (purchase already updates `last_purchase_at`).

**Idempotency:** always set to `now()`; no history table in this PR.

### 5.3 Segment rule

Extend `lib/marketing/segments-rules.ts` with `not_contacted_days: number` — match when `last_contacted_at` is null **or** older than N days (calendar days, business-local date optional; default UTC/date-only consistent with existing `inactive_days`).

Ship ability to create / use a preset or documented rule: **Not messaged in 30 days**.

---

## 6. Follow-up desk (`/marketing`)

### 6.1 First viewport

Three equal panels above the fold (desktop + mobile stack):

| Panel | Membership (approx) |
|-------|---------------------|
| **Dormant** | Existing dormant / at-risk purchase inactivity (reuse auto-tag or `inactive_days` helper) |
| **No purchase** | `order_count = 0` (or null/`last_purchase_at` null) and has phone |
| **Not messaged 30d** | `not_contacted_days` rule and has phone |

Cap ~15–20 rows per panel; “View all” deep-links to customers/segments filtered when available.

### 6.2 Row actions

Each row: name, short reason chip, **WhatsApp** opening the template sheet for that panel’s reason. Customers may appear in more than one panel — allowed; primary chip = panel reason.

### 6.3 Below the fold

Existing KPIs, broadcasts shortcuts, activity feed — do not compete with the three panels.

---

## 7. One-tap WhatsApp

### 7.1 Templates (pure)

`lib/marketing/follow-up-messages.ts` (name flexible):

```ts
type FollowUpReason = "dormant" | "no_purchase" | "check_in";

buildFollowUpMessages({
  reason: FollowUpReason;
  customerName: string;
  businessName?: string;
}): { en: string; ms: string }
```

No IC / sealed fields in templates. Unit-test EN/MS include name + reason intent.

### 7.2 UI

Shared strip/sheet (pattern from HR leave decision sheet): **Copy EN · Copy MS · Open WhatsApp** (disabled → “Add phone first”).

Surfaces: desk rows, customer profile, optionally segment member row if low-cost.

Open WhatsApp flow: mark-contacted → `wa.me/{digits}?text=…` (preferred locale text as primary).

---

## 8. Coupon clarity

### 8.1 POS

- Clearer label / helper under coupon field (“Coupon code from Marketing”).
- On successful validate/redeem: visible success cue with code + discount summary (toast or inline).

### 8.2 Customer page

- Section **Coupons redeemed**: code, redeemed_at, discount/amount from existing redemption records.
- Empty: “No coupons yet.”

No new coupon engine; read existing redemption data.

---

## 9. Import / merge polish

- Wizard summary: explicit counts for create / merge / reject before commit.
- Duplicate phone path: always surface merge CTA (existing merge APIs).
- Copy/clarity only — **no** new merge-inbox queue or background duplicate scanner.

---

## 10. Entitlement

Marketing pillar remains Solo+ only (`micro` | `sme` | `enterprise`). No Marketplace SKU gate for these Strong features — they are core Marketing UX.

---

## 11. Testing

| Area | Tests |
|------|--------|
| Templates | Unit: EN/MS; no 12-digit IC patterns |
| Desk partitions | Unit: dormant / no purchase / not contacted buckets |
| Segment rule | Unit: null vs stale `last_contacted_at` |
| Mark contacted | API or helper unit with mocked Supabase |
| Manual smoke | Solo+ `/marketing` three panels → WA → `last_contacted_at` set; POS coupon cue; customer redemption list; import merge counts |

---

## 12. Docs / checklist

- Update `docs/CHECKLIST.md` §8 + add §12d Marketing Strong when shipped.
- HR Strong §15: point to this spec (no longer “out of scope only”).
- Fix stale CHECKLIST wording “Pro (enterprise)” → Solo+ if touched in same docs pass.

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Optimistic WA stamp (user never sends) | Accept for CTC; optional future “undo contact” out of scope |
| Same customer in multiple panels | Allowed; panel-specific reason chip |
| Import polish expands into merge product | Hard stop: wizard UX only |
| Overlap with Marketplace `dormant-reactivation` add-on | Strong uses core desk; leave add-on as coming-soon automation later |

---

## 14. File map (indicative)

| Path | Role |
|------|------|
| `supabase/migrations/YYYYMMDDHHMMSS_customers_last_contacted.sql` | Column + index |
| `lib/marketing/follow-up-messages.ts` | EN/MS templates |
| `lib/marketing/follow-up-desk.ts` | Pure bucket helpers |
| `lib/marketing/segments-rules.ts` | `not_contacted_days` |
| `app/api/marketing/customers/[id]/mark-contacted/route.ts` | Touch endpoint |
| Broadcast mark-sent route | Also touch |
| `components/marketing/*` | Desk panels, WA strip, coupon history, import copy |
| Marketing overview page / loader | Three panels data |

---

## 15. Approval

Section approvals in chat:

1. Problem / goals / non-goals — **yes**  
2. Data model & contact stamps — **yes**  
3. UI surfaces (desk, WA, coupons, import) — **yes**  
4. Architecture / testing / risks — **yes**

Awaiting implementation via `docs/superpowers/plans/2026-08-20-marketing-strong.md`.
