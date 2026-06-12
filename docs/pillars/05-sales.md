# Pillar 5 — Sales

> Track leads and take payment at the counter.

## 1. Goal & User

**Primary user:** the owner, plus cashier staff for the POS surface.
**Job to be done:** never lose a warm lead, and ring up sales fast at the counter using just a phone.

## 2. Base Package Features

### 2.1 Sales Prospect CRM
Lead tracker for incoming customers who haven't bought yet.

- Lead card fields: name, phone, channel (WA / IG / walk-in / referral), interest, value estimate, **conversational status**.
- Statuses: `New → Contacted → Negotiating → Won → Lost`.
- Notes timeline per lead.
- One-tap **convert to Customer** (creates entry in Marketing CRM).

### 2.2 Basic Mobile POS Interface
A fast, **quick-tap product grid** built for retail or cafe smartphones.

- Big-tap product grid (uses Operations → Product Manager catalog, including Variants).
- **Payment methods at v1 core:**
  - **Cash**
  - **Static DuitNow QR** (display the merchant's static QR, cashier confirms received).
  - **Dynamic DuitNow QR per amount** — generates a QR with the exact sale amount + reference encoded inline. Customer scans, pays, owner sees the matching reference. **No merchant account required** for owners using a personal DuitNow ID; the QR generation is client-side using the registered DuitNow ID + amount + reference. (FPX, cards, e-wallets remain in the future Payment Gateway Connector add-on.)
- Goal: log a sale in **under 5 seconds**.
- Outputs a sale record + ledger entry (Finance).
- Optional: attach a customer to the sale (Marketing CRM).
- **Discounts at the till** — apply a fixed-amount or percentage discount to the cart subtotal. Default: any cashier can discount up to RM 5 / 5%; above that, an optional **manager PIN** is required (configurable per business — owners can disable the PIN gate entirely if they want).
- **SST line on receipts** — toggle per business (mirrors the Finance setting). When enabled, the receipt shows Subtotal / SST / Total.
- **Refunds & Voids** — proper ledger reversal flow, not a delete. Two distinct flows:
  - **Void** — for an erroneous ring-up before the customer leaves the counter; reverses the entire sale, marks it `VOIDED`, ledger entry is reversed.
  - **Refund** — for a returned item / cancelled service; partial or full refund supported, generates a `REFUND` ledger entry against the original sale, optionally returns stock count (when Micro Stock Tracker add-on is active).
  - All voids and refunds are auditable: actor (cashier / manager), timestamp, original sale reference, reason.

### 2.3 Lead → Won → POS Sale Flow
Connects the Lead CRM to the POS surface so the sales motion is one funnel, not two screens.

- From any Lead card, owner taps **Convert to Sale**.
- The POS opens with the lead's customer details + interest line items prefilled in the cart.
- Owner reviews the cart, picks a payment method, completes the ring-up.
- On completion:
  - Lead status flips to `WON`.
  - Customer record is created/merged into Marketing CRM (via the same `customer.created` dedup rules).
  - Sale record is logged with a back-reference to the original lead for attribution.

## 3. Marketplace Add-ons

| Add-on | Price | What it unlocks |
|--------|------:|-----------------|
| **Stale Deal & Detail Alarms** | +RM15/mo | Instant reminders if premium buyer leads freeze up or stay **uncontacted for more than 48 hours**. |
| **Hardware & Advanced POS Extensions** | +RM25/mo | Bluetooth pairing with **thermal receipt printers**, **mobile-camera barcode scanning**, **table management** maps, and **offline client-data caching**. |

## 4. Data Model Sketch

```
Business
 ├── leads[]
 │    ├── id, name, phone, channel
 │    ├── interest_text, value_estimate_myr
 │    ├── status: NEW|CONTACTED|NEGOTIATING|WON|LOST
 │    ├── last_contacted_at        ← drives stale-deal alarm
 │    ├── notes[]                  { ts, author_id, text }
 │    └── converted_customer_id (nullable)
 └── sales[]                       (POS rings)
      ├── id, cashier_user_id
      ├── line_items[] (refs products)
      ├── subtotal, discount, total
      ├── payment_method: CASH|DUITNOW_QR
      ├── customer_id (nullable)
      ├── created_at
      └── synced (true if not in offline cache)   ← add-on
```

## 5. Key User Flows

### 5.1 Take a sale in under 5 seconds
1. Cashier opens **POS** → product grid.
2. Taps 1–3 product tiles.
3. Taps **Cash** (or **DuitNow QR** → shows static QR for customer to scan).
4. Confirms → sale logged, ledger entry created, optionally tagged to a customer.

### 5.2 Convert a lead to a customer
1. Sales → Leads → open card.
2. Update status to **Won** → modal asks "Convert to Customer?".
3. Confirm → customer record created in Marketing CRM, lead persists with `status='WON'` and `converted_customer_id` set (preserves attribution; locked in `docs/plans/marketing-decisions.md` Q7). Sales pipeline view defaults to filtering `status IN ('NEW','QUALIFIED','CONTACTED','NEGOTIATING')` so won leads don't clutter the active board.

### 5.3 Stale deal alarm (add-on)
1. Lead status `Negotiating` + `last_contacted_at` > 48h ago.
2. System pushes notification to owner: _"5 leads have gone quiet — follow up?"_

### 5.4 Counter setup with hardware add-on
1. Owner pairs Bluetooth thermal printer once in settings.
2. Each POS sale auto-prints a receipt.
3. Cashier scans barcode using phone camera → matches SKU → adds to cart.
4. When internet drops, sales queue locally and sync when back online.

## 6. Open Questions

- Multi-cashier / shift handover for retail with rotating staff.
- Table management (Hardware/POS add-on) — does it integrate with the Operations Booking calendar, or stand-alone?
- End-of-day cash drawer reconciliation — base or add-on? _(Currently planned as a future add-on.)_
- Receipt customization (logo, footer, IG handle, BM thank-you) — base or part of Custom Document Builder add-on?

> Resolved (now in core, v2026-06-12): Dynamic DuitNow QR per amount · POS discounts (fixed + percentage, optional manager PIN) · Refunds & Voids with proper ledger reversal · SST line on receipts · Lead → Won → POS one-tap flow.
