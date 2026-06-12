# v1 Base Package — Finalized Core Scope

> Canonical record of what every pillar ships in v1's Base Package, after the core/add-on review on 2026-06-12.
> The add-on platform work is **deferred**; v1 ships the **core** of all six pillars.
> Per-pillar canonical specs live in each pillar's `§2 Base Package Features` in `docs/pillars/0X-*.md`. This doc is the at-a-glance summary.

---

## Decision Principle

A feature belongs in **core** only if all three are true:

1. **Universal** — every micro-SME persona needs it (kedai · kafe · salon · homestay · online seller · solo service).
2. **Cheap to build and run** — no specialized hardware, no AI cost spike, no per-segment customization.
3. **Closes a loop** — without it, an existing core feature is half-broken.

Anything else stays an add-on.

---

## Pillar 1 — Admin (Core Scope)

| Feature | Status |
|---------|--------|
| Digital Storage 1 GB | Locked-in |
| Smart Task Matrix (Kanban) | Locked-in |
| System Notification Feed | Locked-in |
| Document Template Library (locked, fill-in-the-blank) | Locked-in |
| **Compliance Calendar** — SSM renewal, signboard licence, halal / food-handler certs, insurance, business permits | **NEW in core** |
| **Digital Signature on Shared Documents** — recipient signs the share link with finger; signed PDF returns to owner | **NEW in core** |

---

## Pillar 2 — Finance (Core Scope)

| Feature | Status |
|---------|--------|
| Basic Accounting Module (revenue / expense ledger) | Locked-in |
| Invoice Generator (secure URL) | Locked-in |
| **Universal "Pay Now" Panel on Invoice URL** — displays merchant DuitNow ID + amount + reference, tap-to-copy each field. **No merchant account required** (DuitNow Transfer is universal + free in Malaysia). | **NEW in core** |
| **Per-Business Invoice Numbering** — sequential `INV-2026-0001` numbers alongside the secure hash | **NEW in core** |
| **Simple SST Line** — flat percent toggle per business; line item on invoice + expense | **NEW in core** |
| **Quote → Invoice Converter** — one tap converts an Admin Quotation document into a prefilled Invoice | **NEW in core** |
| **Late-Payment Reminder Generator** — overdue invoices show a button that produces a WA-ready BM/EN reminder script for owner to send | **NEW in core** |

> **FPX / Cards / E-wallets are NOT in v1 core.** They require a merchant account (Billplz / Curlec / Stripe / iPay88) which most micro-SMEs don't have on day one. They will ship later as a new add-on, **Payment Gateway Connector**, layered on top of the same invoice URL — see [Downstream Doc Changes Required](#downstream-doc-changes-required).

---

## Pillar 3 — Operations (Core Scope)

| Feature | Status |
|---------|--------|
| Order Fulfillment Pipeline (Kanban) | Locked-in |
| Supplier Directory + material cost log | Locked-in |
| Product Manager (catalog) | Locked-in |
| Services & Booking Slot Manager | Locked-in |
| **Configurable Pipeline Columns** — businesses can rename, reorder, and add columns to fit their workflow (kafe ≠ kedai ≠ salon stages) | **NEW in core** |
| **Product Variants** — one parent SKU with multiple variants (size, colour, weight, flavour) | **NEW in core** |
| **Customer-Facing Booking Page** — public secure-hash URL (`bantuniaga.com/[idcompany]/book-[hash]`) for customers to self-book service slots | **NEW in core** |
| **Buffer Time Between Bookings** — per-resource setting (e.g. 10 min salon turnover, 4 h homestay cleanup) | **NEW in core** |

---

## Pillar 4 — Marketing (Core Scope)

| Feature | Status |
|---------|--------|
| Customer Profiles CRM (with derived purchase metrics) | Locked-in |
| Social Media Content Calendar (TikTok / IG / FB, plan-only) | Locked-in |
| **Phone-Based Customer Dedup** — auto-merge or prompt on collision when `customer.created` events fire | **NEW in core** |
| **Auto Customer Segmentation Tags** — `new`, `repeat`, `vip`, `dormant`, `at-risk` computed from CRM fields (zero AI cost; threshold rules) | **NEW in core** |
| **Customer CSV Import + Export** — bulk onboarding for businesses with existing customer lists | **NEW in core** |

---

## Pillar 5 — Sales (Core Scope)

| Feature | Status |
|---------|--------|
| Sales Prospect CRM (lead pipeline) | Locked-in |
| Basic Mobile POS — Cash + Static DuitNow QR | Locked-in |
| **Dynamic DuitNow QR per Amount at POS** — generates QR with the exact sale amount + reference baked in (no merchant account required for personal DuitNow IDs) | **NEW in core** |
| **POS Discounts** — fixed amount + percentage, optional manager PIN override | **NEW in core** |
| **Refunds & Voids** — proper ledger reversal flow with auditable trail | **NEW in core** |
| **SST Line on Receipts** — toggle per business, mirrors the Finance setting | **NEW in core** |
| **Lead → Won → POS Sale Flow** — one-tap conversion from a Won lead card to a POS ring-up with line items prefilled | **NEW in core** |

---

## Pillar 6 — HR (Core Scope)

| Feature | Status |
|---------|--------|
| Core HRM Registry (employees, encrypted IC + bank fields) | Locked-in |
| Leave Overview Dashboard (AL / EL / MC) | Locked-in |
| **State-Aware Malaysian Public-Holiday Calendar** — auto-populated; integrates with AL accruals + Booking calendar blocking | **NEW in core** |
| **AL Carry-Forward Rules** — configurable per business; sensible default cap (e.g. 1.5× annual entitlement) | **NEW in core** |
| **Onboarding Checklist Template** — per business; applied to every new employee record | **NEW in core** |
| **Contract / Employment Letter Generator** — uses the Admin Document Template engine with HR fields prefilled | **NEW in core** |

---

## Resolved Open Questions

The following items, previously listed in pillar `§6 Open Questions`, are now closed by the v1 core decision:

| Pillar | Open Question | Resolution |
|--------|---------------|------------|
| Finance | Tax (SST) handling — flat field or full tax engine? | **Flat field in core**; full tax engine remains in the Full Ledger add-on. |
| Finance | Per-business numbering rules alongside the hashed URL? | **Yes, in core** — `INV-2026-0001` + secure hash. |
| Operations | Are pipeline columns user-configurable in v1, or fixed? | **Configurable in core.** |
| Operations | Product Manager variants in v1, or each variant its own SKU? | **Variants in core.** |
| Operations | Buffer time between bookings? | **Yes, in core.** |
| Marketing | Customer dedup rule — by phone, or phone + name? | **By phone in core**, with name-mismatch warning. |
| Marketing | Bulk-import historical customers from CSV — base or add-on? | **Base.** |
| Sales | DuitNow QR — strictly static at v1, or dynamic? | **Dynamic in core** (static remains the fallback). |
| Sales | Discounts at POS — fixed, percentage, both, manager override? | **Both, with optional manager PIN — in core.** |
| Sales | Refunds / voids flow and ledger impact? | **In core**, with proper reversal entries. |
| Sales | SST line on receipts — base or add-on? | **Base.** |
| HR | Public-holiday calendar (state-aware) — auto-populated? | **Auto-populated in core.** |
| HR | Carry-forward rules for AL — base or configurable per business? | **Configurable per business — in core.** |

---

## Downstream Doc Changes Required

These updates fall out of the core decision but are not part of this finalization. They should follow soon after:

1. **`docs/marketplace-addons.md`** — add a new Finance add-on **Payment Gateway Connector** (Billplz / Curlec / Stripe / iPay88), surfaces FPX, cards, e-wallets, dynamic DuitNow QR with auto-reconciliation via webhook.
2. **`docs/PRD.md`** — verify alignment if it has its own scope section.

(Tier and price data lives in code under `lib/billing/tiers.ts`, not in docs.)

The add-on platform itself (the 5-contract architecture: schema slots · events · UI slots · feature flags · permission scopes) is **deferred** — to be revisited after v1 core ships.

---

## What's NOT in v1 Core

Everything below the core line stays in `docs/marketplace-addons.md`. Reference highlights:

- **Admin:** Custom Document Builder · Storage 5 GB / 20 GB tiers · Receipt OCR (future)
- **Finance:** Full Ledger Analytics · LHDN Exporter · **Payment Gateway Connector** (new) · Recurring Invoices (future) · Cashflow Forecast (future) · Bank statement CSV import (future)
- **Operations:** Micro Stock Tracker · Recipe / BOM (future) · Multi-location stock (future) · Auto-PO from low-stock (future) · Delivery tracker (future) · Recurring bookings (future)
- **Marketing:** Smart Link Tracker · Promo Engine · WA Broadcast Manager (future) · Loyalty stamps (future) · Reviews collector (future)
  > Marketing M1 (2026-06-12) shipped the canonical `customers`, `customer_tag_history`, `customer_csv_imports`, `content_plan(+_media)` schema, plus the `customer_external_refs` registry (empty — downstream pillars register their own FKs) and `marketing_event_dedup` (table only — the M6 listener writes to it).
- **Sales:** Stale Deal Alarms · Hardware / POS Extensions · Layaway tracker (future) · Online storefront (future) · End-of-day reconciliation (future)
- **HR:** Shift Rota · Self-Service Leave Forms · Statutory Payroll EPF/SOCSO/EIS/PCB (future) · Time Clock (future) · EA Form generator (future)

---

## Build Sequencing Implication

The new core additions are small relative to the existing base and **do not push out the Week-12 first-paying-customer milestone**.

| Phase | Weeks | Tier | Pillars (full Core Scope above) |
|-------|------:|------|---------------------------------|
| Phase 1 | 5–12 | Starter | Admin · Finance · Operations |
| Phase 2 | 13–20 | Micro | + Marketing · HR |
| Phase 3 | 21–28 | SME | + Sales |
| Phase 4 | 29–36 | — | AI Agents (optional, per pillar) |
| Phase 5 | 37–44 | — | Executive Boardroom |

---

## Change Log

| Version | Date | Notes |
|---------|------|-------|
| v1.0 | 2026-06-12 | Finalized v1 Base Package across all 6 pillars after core/add-on review with founder. Add-on platform deferred; FPX moved to a new Payment Gateway Connector add-on. |
