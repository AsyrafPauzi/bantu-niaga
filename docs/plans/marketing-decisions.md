# Marketing Pillar — Decisions Locked

> **Status:** Locked v1 · 2026-06-12
> **Companion to:** [`marketing-implementation-plan.md`](./marketing-implementation-plan.md)
> **Why this doc exists:** The implementation plan flagged 12 blocking questions and 15 default assumptions. This doc closes every one of them so M1 can start without re-litigating decisions mid-build.

Every decision below is the working default for v1. Changing one mid-build means a migration or a refactor — flag it explicitly before reopening.

---

## 1. The 12 Blocking Decisions

### Q1 — VIP threshold: hard-coded in v1

**Decision:** Hard-code `vip` at `total_spend_myr ≥ RM 1,000` OR `order_count ≥ 10`. Per-business overrides land post-v1.

**Why:** Configurable thresholds need an extra `business_segmentation_overrides` table, a settings UI surface, and a fallback resolver in the nightly tag refresh. None of that is core to the customer-record loop. Adding the override table later is purely additive (no breaking change to existing `customer.tag_changed` payloads).

**Resolves conflict between:** `pillars/04-marketing.md` §2.1 (says configurable) vs plan §6.4 (says hard-coded). Pillar doc updated to match (see §4 below).

**Plan ref:** §6.4, §12.1.

---

### Q2 — Notes: single text field

**Decision:** `customers.notes text` — single field. No `customer_notes[]` timeline table in v1.

**Why:** Owners type freeform notes. A timeline table buys per-entry timestamps + author attribution but doubles the read query for a feature few SMEs will use. If a v2 timeline ships later, the existing `notes` field becomes the seed entry of the timeline (one-row migration).

**Plan ref:** §2.2, §12.2.

---

### Q3 — Service-role helper + tenant-scoped wrapper

**Decision:** Ship `lib/supabase/service-role.ts` AND `lib/marketing/upsertFromPos.ts`. The service-role helper is the only path that bypasses RLS, and `upsertFromPos.ts` is the only caller of it from the Marketing surface.

**Constraints on the wrapper:**

- Every query in `upsertFromPos.ts` MUST include `.eq("business_id", businessId)`.
- The wrapper accepts `businessId` as a non-optional positional arg and asserts `typeof businessId === "string" && businessId.length > 0` before any DB call.
- A unit test (M1) confirms the wrapper rejects an empty `businessId` and that every code path includes the `.eq("business_id", …)` clause.
- `SUPABASE_SERVICE_ROLE_KEY` added to `.env.example` with a comment that it must NEVER be exposed to the browser.

**Why:** Service-role bypass is the right tool for cross-pillar internal calls (POS cashier doesn't get Marketing perms in the matrix), but the foot-gun is real. Concentrating it in one wrapper file with explicit business-id guarding makes the audit surface tiny.

**Pairs with Q11** below.

**Plan ref:** §9.1, §12.11.

---

### Q4 — Phase 0 dispatcher: NOT Marketing's problem

**Decision:** Marketing M1–M5 emit to `events_outbox` and assume the dispatcher does not exist yet. No temp in-process worker. M6 (the cross-pillar metric listener phase) hard-blocks on dependency **D8** from the other dev (Admin / Phase 0 owns the dispatcher).

**Why:** Building a temp dispatcher in M1 is throwaway work — it gets ripped out the moment Phase 0 ships the real one. Marketing's M1–M5 work is fully testable without a working dispatcher because the assertions are "did the outbox row appear with the right payload," not "did the listener fire."

**M6 starts only after D8 lands.** If D8 slips, M6 slips — that's an explicit dependency, not a hidden one.

**Plan ref:** §1 preamble, §3.3 D8, §11 M1.

---

### Q5 — Merge re-pointing via `customer_external_refs` registry

**Decision:** Ship `customer_external_refs` registry table in M2. Schema:

```sql
create table public.customer_external_refs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  fk_column     text not null,
  pillar        text not null,         -- 'finance' | 'operations' | 'sales' | …
  notes         text,
  created_at    timestamptz not null default now(),
  unique (table_name, fk_column)
);
```

Marketing's merge handler reads from this registry and runs an `UPDATE {table_name} SET {fk_column} = $new WHERE {fk_column} = $old AND business_id = $business_id` for each row. No `information_schema` reflection. No silent missed tables.

**Each downstream pillar registers its own FK columns** as part of their migration:

```sql
-- in finance migration
insert into public.customer_external_refs (table_name, fk_column, pillar)
values ('invoices', 'customer_id', 'finance');
```

Marketing's M2 ships an empty registry (Marketing has no FKs to itself). Finance / Operations / Sales add their rows when they land.

**Why:** Cleaner than `information_schema` reflection (no slow catalog scans, no surprise hits on test tables), cleaner than feature-flagging per-table (registry is one place to audit), cleaner than waiting for sister pillars to ship (Marketing M2 doesn't block).

**Plan ref:** §4.2.5, §3.1.2.

---

### Q6 — Phones: any valid E.164

**Decision:** Accept any phone matching `^\+\d{8,15}$`. Default `+60` is added when the input is unprefixed and starts with `0` (e.g. `012-3456789` → `+60123456789`). Foreign numbers are accepted as-is when prefixed.

**Why:** Homestays, online sellers, and exporters serve foreign customers. Rejecting non-`+60` would force owners to fake-format real customers' phone numbers. The `source` enum on `customers` already captures origin if attribution matters.

**No `international` auto-tag in v1** — over-engineering for a niche segment.

**Plan ref:** §7.1.

---

### Q7 — Lead persists with `status = 'WON'`

**Decision:** When Sales converts a lead, the `leads` row stays. `status` flips to `WON` and `converted_customer_id` is set. The lead is NOT deleted, NOT soft-archived.

**Sales pipeline UI:** active board defaults to `status IN ('NEW','QUALIFIED')`. Won leads appear under a "Won" column when the user opts to view it.

**Resolves conflict between:** `pillars/05-sales.md` §5.2 (says "lead is archived") vs marketing plan §3.2.4 (says lead persists). Pillar 05 doc will be updated to match this once the Sales plan worker finishes (see §4 below — pending edit).

**Why:** Preserves lead-source attribution forever (e.g. "this RM 80k customer started as a Facebook lead from Raya 2026 campaign"). The "noisy pipeline" concern is solved by default filters at the query level, not by archiving rows.

**Plan ref:** §3.2.4.

---

### Q8 — Soft-delete via `deleted_at`

**Decision:** Add `customers.deleted_at timestamptz` column. `DELETE /api/marketing/customers/[id]` sets `deleted_at = now()` (does not hard-delete). Soft-deleted rows are excluded from list / search / API GETs but FKs from `invoices`, `orders`, `bookings`, `leads` continue to resolve.

**Override on plan recommendation:** Plan §12.3 picked 405. Decision flips to soft-delete because:

- Owners hit "I added a junk row by mistake" before they ever hit "I have two real customer records to merge." 405 forces them through merge for a use case merge wasn't designed for.
- Tombstone resolves both cases cleanly: junk → delete; duplicate → merge.
- One column is cheap. Re-introducing soft-delete after shipping 405 means a migration + an API contract change.

**RLS impact:** Add `deleted_at IS NULL` to the SELECT policy's where clause for the default list path. Owners can opt into a "show deleted" view post-v1 if requested (not v1 surface).

**Plan ref:** §4.1, §12.3.

---

### Q9 — CSV phone-collision-with-name-mismatch: REJECT row

**Decision:** Bucket as `rejected` with reason `"phone {+60xxx} already belongs to {existing name}; you imported as {imported name} — fix the CSV row and re-upload"`. Owner fixes the CSV, re-uploads only the failed rows.

**Why:** Determinism on bulk imports beats UX forgiveness. A 5,000-row CSV with 200 phone collisions in `prompt` mode means 200 in-app merge prompts — that UX is worse than just fixing the CSV. Reject + clear error message is the right v1 ergonomic.

**Re-evaluate post-v1** if owners hit this enough that the in-app merge inbox becomes worth building.

**Plan ref:** §8.3, §12.10.

---

### Q10 — Mobile editable fields: notes, manual_tags, phone

**Decision:** Mobile customer detail edits exactly three fields:

- `notes` (textarea)
- `manual_tags` (chip input)
- `phone` (with the same E.164 validation + dedup-prompt flow as desktop)

Everything else (name, email, address) is **desktop-only**. The mobile detail page shows them read-only with a "Edit on desktop" hint.

**Why:** Solo owners on the road want to add a note ("called Pak Rahman, picks up Friday") or fix a phone number. They don't want to type a full address on a phone keyboard. Three fields cover ~90 % of mobile edits without ballooning the mobile UX into a desktop port.

**Plan ref:** §5.1, §5.2.

---

### Q11 — Cashier customer search: dedicated Sales endpoint

**Decision:** Cashier does NOT touch `/api/marketing/*`. Instead, Sales owns:

- `GET /api/sales/pos/customer-search?q={phone_or_name}` — gated by `cashier.sales = 'rw'`.
- `POST /api/sales/pos/customer-upsert` — gated by `cashier.sales = 'rw'`.

Both endpoints internally call `lib/marketing/upsertFromPos.ts` (the service-role wrapper from Q3) for the actual customer-table read/write.

**Permissions matrix:** unchanged. Cashier still has zero permissions on `marketing.*`. The existing matrix stays clean.

**Why:**

- Sales owns the cashier flow → its endpoints belong under `/api/sales/`.
- Marketing keeps its API surface as the "marketing operator" surface only.
- The matrix doesn't need a special `customers_search` row.
- Route taxonomy matches mental model.

**Plan ref:** §9.1, §9.2, §12.11.

---

### Q12 — Test coverage staged across milestones

**Decision:** Staged.

| Milestone | Test layers |
|---|---|
| **M1** | Unit + RLS + API integration |
| **M2** | + Component tests (CRM list/detail/merge banner) |
| **M3** | + Golden-file CSV fixtures (round-trip import → export) |
| **M4** | + Component tests on `computeAutoTags` |
| **M5** | + Component tests on calendar grid |
| **M6** | + Event-bus integration tests (with Phase 0 dispatcher) |

CI gate (plan §10.6) is fully online by M3 (when the matrix of unit + RLS + API + component coverage is non-trivial). Before M3, CI runs a "soft" gate that warns but doesn't fail on coverage.

**No Supabase local harness or component test runner exists yet** — both come online in M1 and M2 respectively as part of these stages.

**Why:** Shipping all six layers from M1 adds two days to the first milestone. Staging them lands meaningful coverage early without bottlenecking M1 on test infra.

**Plan ref:** §10.

---

## 2. The 15 Assumptions — Confirmed As Defaults

All confirmed as proposed in the blocker review:

1. Table names match plan §2.
2. `merged_into_id` self-FK as the soft-merge marker. **Now combined with `deleted_at` from Q8** — a row can be either merged-into-another or soft-deleted, never both.
3. `pg_trgm` extension added inside Marketing's migration (`create extension if not exists pg_trgm`) — D9 dependency made idempotent.
4. `csv-imports` Supabase Storage bucket created via migration with private ACL, path `csv-imports/{business_id}/{import_id}.csv`.
5. CSV row cap 5,000 + file size 5 MB + preview retention 24h. **If owners regularly hit this, raise to 10,000 in v1.1 (not v1).**
6. Manual tags free-form `text[]`, capped at 20 entries × 40 chars each.
7. `customer.updated` ships in v1 even with no listener — cheap, future-proof for AI agent consumption.
8. No merge inbox UI in v1; only in-context `<MergePromptBanner>` on customer detail.
9. Nightly tag refresh via Supabase Edge Function scheduled trigger (NOT pg_cron). pg_cron not enabled in baseline migration.
10. `papaparse` + `@types/papaparse` added in M3.
11. `marketing_event_dedup (event_id uuid pk, processed_at)` ships in M6 as a per-handler dedup table. Drop later if D8 provides global dedup.
12. All Marketing API routes go through `getCurrentUser()` + `canSurface()` before any DB call. RLS is defense-in-depth.
13. `customer.created.source` union extended with `"public_booking_page"` in `lib/events/types.ts`.
14. `PATCH /customers/[id]` returns `action: "prompt"` when the new phone collides — mirrors the create flow.
15. `lib/pillars/index.ts` Marketing surfaces extended to add `Import` (desktop primary) so the desktop sidebar renders it.

---

## 3. Out-of-Scope — Confirmed Deferred

All of the below are **intentionally not in v1**. They live in `docs/marketplace-addons.md` or post-v1 backlog:

- Smart Link Tracker (UTM)
- Promo Engine & WhatsApp Script Templates
- WA Broadcast Manager
- Loyalty stamps / Reviews Collector / Birthday Auto-Greet
- Auto-posting to TikTok / IG / FB
- Full UTM attribution beyond the `source` enum
- Per-business overridable segmentation thresholds (Q1 above)
- Customer-facing self-service profile editing
- Multi-channel customer activity timeline beyond `notes text` (Q2)
- Merge inbox UI
- Full merge audit screen for desktop

---

## 4. Schema Additions Implied by Decisions

These are NEW columns / tables relative to plan §2. M1's migration must include them:

```sql
-- Q5: cross-pillar FK registry for customer.merged re-pointing
create table public.customer_external_refs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  fk_column     text not null,
  pillar        text not null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (table_name, fk_column)
);

-- Q8: soft-delete tombstone column on customers
alter table public.customers add column deleted_at timestamptz;
create index customers_deleted_at_idx on public.customers (deleted_at)
  where deleted_at is not null;
```

RLS policies on `customers` get an extra `and deleted_at is null` clause on the default SELECT path (Q8).

---

## 5. Doc Updates Triggered

These doc updates land alongside this decisions doc:

- [x] `docs/pillars/04-marketing.md` §2.1 — VIP threshold reworded from "business-configurable threshold (default RM 1,000)" to "hard-coded RM 1,000 in v1; per-business override in v2" (Q1).
- [x] `docs/plans/marketing-implementation-plan.md` — header callout pointing to this decisions doc.
- [ ] `docs/pillars/05-sales.md` §5.2 — "lead is archived" → "lead persists with `status='WON'` and `converted_customer_id`" (Q7). **Pending: deferred until Sales implementation plan worker completes to avoid race-edit.**
- [ ] `docs/architecture/cross-pillar-sync.md` — add `customer_external_refs` registry pattern to the merge-handling section (Q5). **Pending: after M2 ships and the pattern is real code, not just a plan.**

---

## 6. Revised Execution Order

Phases unchanged from the blocker review's §5, with M1 scope made explicit per the decisions above:

### Phase 1 — Foundation (M1)
- Migration: 5 plan §2 tables + `customer_external_refs` (Q5) + `customers.deleted_at` (Q8) + RLS + indexes.
- `lib/supabase/service-role.ts` (Q3).
- `lib/marketing/upsertFromPos.ts` (Q3) with the business-id guard contract.
- `lib/marketing/phone.ts` (E.164 normalization, accepts foreign per Q6).
- `lib/marketing/dedup.ts` (phone match → `new` | `merge` | `prompt`).
- Extend `lib/events/types.ts` with new event names + payloads (Q4 — emit only).
- `POST /api/marketing/customers` end-to-end with outbox emission.
- Tests: unit + RLS + API integration (Q12).

### Phase 2 — CRM list/detail UI (M2)
- Remaining customer API routes (`GET` list, `GET [id]`, `PATCH`, merge, search).
- `DELETE /api/marketing/customers/[id]` → soft-delete tombstone (Q8).
- Merge handler reads `customer_external_refs` registry (Q5).
- Desktop list + detail; mobile summary card with **3-field edit** (Q10).
- `<MergePromptBanner>`, `<CustomerForm>`, `<TagBadge>`.
- Tests: + component layer (Q12).

### Phase 3 — CSV import/export (M3)
- Storage bucket + upload/preview/commit/export endpoints.
- `<CsvImportWizard>` with `rejected` row UX (Q9).
- Golden-file fixtures (Q12).
- CI gate fully online (Q12).

### Phase 4 — Sales POS handshake (M3.5 — sequenced into M3 if scope allows)
- `/api/sales/pos/customer-search` and `/api/sales/pos/customer-upsert` (Q11).
- Both internally call `lib/marketing/upsertFromPos.ts`.

### Phase 5 — Auto-segmentation (M4)
- Edge Function `marketing-tag-refresh` with hard-coded thresholds (Q1).
- `customer.tag_changed` emission.
- Backfill script.

### Phase 6 — Content calendar (M5)
- API + calendar grid + entry editor.
- Media-attach with placeholder file IDs until Admin lands D6.

### Phase 7 — Cross-pillar metric listeners + KPI cards (M6)
- Hard-blocked on D1–D4 (Finance / Operations payload extensions) and D8 (dispatcher).
- Listeners: `invoice.paid`, `order.delivered`, `booking.completed`, `lead.converted`.
- `marketing_event_dedup` table.
- `/marketing` landing KPI cards.
- Tests: + event-bus integration (Q12).

---

## 7. What Still Needs Your Input

Nothing in this doc. Every blocker is closed. The next decision points are:

- **After Sales plan lands:** review §5.2 lead-archive wording (Q7 doc edit).
- **After M3 ships:** validate the `rejected`-bucket UX with a real owner; flip to `prompt` if the friction is too high (Q9).
- **After M6 ships:** decide whether `marketing_event_dedup` can be retired in favor of D8's global dedup.

Everything else is locked.
