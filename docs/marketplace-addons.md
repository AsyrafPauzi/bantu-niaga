# Marketplace — Add-on catalog

> The Marketplace is the in-product switchboard for capabilities that
> aren't bundled with the four plan tiers. Owners turn an add-on on with
> one tap; billing prorates against the current cycle.
>
> This doc records the **catalog that actually ships in the app today**.
> The source of truth is the DB seed in
> [`supabase/migrations/00000000000011_marketplace_m1.sql`](../supabase/migrations/00000000000011_marketplace_m1.sql)
> + the category cleanup in
> [`00000000000014_marketplace_categories.sql`](../supabase/migrations/00000000000014_marketplace_categories.sql).

---

## How the Marketplace works

- The catalog is global (`public.marketplace_addons`, public read).
- Per-business activation state lives in `public.business_addons` with
  owner-only RLS.
- The activate / deactivate flow is atomic via the
  `public.marketplace_activate_addon(slug, qty)` and
  `public.marketplace_deactivate_addon(slug)` RPCs — each writes an
  invoice row + audit-log entry in the same transaction.
- Add-ons are scoped to a single business; they don't transfer between
  tenants.
- `included_in_tier` on each add-on declares the tiers that get it for
  free; activation on those tiers shows **Included** and a *Configure*
  CTA instead of a price.

UI lives in [`components/marketplace/MarketplaceView.tsx`](../components/marketplace/MarketplaceView.tsx).
Server page in [`app/(app)/marketplace/page.tsx`](../app/(app)/marketplace/page.tsx).
Pencil design: **Screen — Marketplace** in `pencil-new.pen`.

## Tabs (UI categories)

The view exposes nine filter chips in this exact order:

```
Admin · HR · Finance · Operations · Marketing · Sales · AI agents · All add-ons · Active
```

> Why no "Cross-cutting" tab? Earlier seeds used a `cross` pillar for
> platform-wide utilities (extra storage, extra seats). Renamed and
> re-classified — storage now lives under **Admin**, seats under
> **Admin**, and the engineer-flavoured "Cross-cutting" bucket is gone
> from the UI. The `cross` value remains valid in the DB check
> constraint and `AddonPillar` TypeScript union for forward-compat;
> no add-on uses it today.

## Live catalog (M1 + 2026-06-14 update)

| Slug                   | Name                            | Pillar     | Price          | Included in           | Notes                                                                 |
|------------------------|---------------------------------|------------|----------------|-----------------------|-----------------------------------------------------------------------|
| `whatsapp-business`    | WhatsApp Business API           | Marketing  | RM 35/month    | —                     | Featured. Tier-1 official channel via Meta. 1,000 free outbound/month. |
| `tiktok-sync`          | TikTok Shop sync                | Marketing  | RM 25/month    | —                     | 15-min two-way sync.                                                  |
| `extra-seat`           | Extra staff seat                | Admin      | RM 15/seat/mo  | —                     | Per-seat. Carries role permissions + audit trail.                     |
| `storage-10gb`         | Extra 10 GB storage             | Admin      | RM 8/month     | —                     | Singapore region. Soft warn at 80%.                                   |
| `boost-credits-300`    | Boost Credits · 300             | AI agents  | RM 50 one-time | —                     | Top up for Maya / Operations AI / Boardroom. Credits never expire.    |
| `boardroom-weekly`     | Boardroom AI weekly digest      | AI agents  | RM 20/month    | —                     | Sunday-morning multi-pillar report.                                   |
| `lhdn-einvoice`        | LHDN e-Invoice connector        | Finance    | Included       | `sme`, `enterprise`   | MyInvois. Mandatory for businesses with >RM 25 m revenue.             |
| `shopee-sync`          | Shopee Mall sync                | Sales      | RM 25/month    | —                     | Daily bank reconciliation. SLS / J&T / DHL pickup integration.        |
| `payroll-bank-export`  | Payroll bank export             | HR         | RM 20/month    | —                     | Maybank · CIMB · Public Bank · RHB direct-credit CSV.                 |
| `holiday-calendar-sync`| Public holiday calendar sync    | HR         | Included       | `sme`, `enterprise`   | MY federal + state holidays into HR leave calendar.                   |

Operations currently has no add-ons (the empty-state copy explains
this); future stock-management add-ons land here.

## Entitlement interaction with plan tiers

Add-ons are independent of the [tier → pillar entitlement
matrix](./architecture/entitlements.md). Activating an add-on does NOT
unlock its pillar:

- A Free-tier owner can activate **Payroll bank export** — but their HR
  pillar is still locked, so the add-on stays dormant until they upgrade
  to Growth or Pro.
- Conversely, an Enterprise owner with the Marketing pillar unlocked can
  still choose not to activate **WhatsApp Business API**.

The product framing: tiers unlock **modules**, add-ons add
**capabilities to modules you already have**.

## Activation / deactivation behaviour

- **Activation** — prorated for the current billing cycle; the feature
  unlocks immediately. The activate RPC computes `v_amount_myr` from
  `price_cents / 100` for the prorated portion and writes an invoice
  row with `period_label = '<name> proration'`.
- **Deactivation** — access remains until `next_charge_at` (the end of
  the paid period); `cancel_at` is stamped and the card shows
  *"Cancels soon"*. No refund. Re-activation before `cancel_at` clears
  the flag.
- **Included** add-ons (LHDN, holiday calendar) cannot be deactivated
  while the tier covers them. The UI swaps the *Activate* button for a
  *Configure* CTA.

## Adding a new add-on

1. Pick a stable `slug` (kebab-case, ASCII).
2. Pick the correct pillar — the tab strip is in the same order as the
   sidebar's pillar order, plus AI agents. If your add-on doesn't fit
   any pillar, that's a signal to rename or split it. The `cross` value
   is a last resort.
3. Decide on `cadence`:
   - `monthly` / `yearly` for recurring,
   - `one_time` for credit packs / setup fees,
   - `included` for tier-bundled features that still need an
     activation toggle.
4. Add a row to the seed insert in migration 11 (or a new migration if
   the seed is already shipped) and re-run `supabase migration up` on
   dev. The `on conflict (slug) do update` clause makes the seed
   idempotent.
5. If the new add-on has a corresponding icon, register it in
   `ICON_MAP` inside `MarketplaceView.tsx` (Lucide icons only).

## Removed sections from earlier drafts

Pre-2026-06-14 the marketplace was framed as a flat catalog of pillar
upgrades (Stock Tracker, Shift Rota, Self-Service Leave Forms…).
That list lives on as a wishlist in
[`v1-core-scope.md`](./v1-core-scope.md) under "What's NOT in v1 Core".
Once those features land, they'll come back here as activatable
add-ons; until then they're not catalogued.
