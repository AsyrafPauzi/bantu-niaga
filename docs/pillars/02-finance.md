# Pillar 2 — Finance

> Track money, send invoices, stay LHDN-compliant.

## 1. Goal & User

**Primary user:** the business owner (and, optionally, a bookkeeper they share access with).
**Job to be done:** record revenue and expenses without learning accounting jargon, send invoices that look professional via WhatsApp, and — when ready — produce LHDN-compliant exports without hiring an accountant.

## 2. Base Package Features

### 2.1 Basic Accounting Module
Quick-log fields for everyday bookkeeping.

- Record **Revenue** entry: amount, source, payment method, date, optional receipt photo.
- Record **Expense** entry: amount, category, vendor, date, optional receipt photo.
- **Simplified digital transaction ledger** — chronological list of all entries with running balance.
- Filters: date range, category, payment method.
- Quick monthly summary card (in / out / net).

### 2.2 Invoice Generator (Secure URL)
Automatic generation of shareable invoices.

- URL pattern:
  ```
  bantuniaga.com/[idcompany]/inv-[secure-random-hash]
  ```
  Example: `bantuniaga.com/intantrade/inv-9k2p4x8w`
- Hash is **non-guessable** (8 chars, random, lowercase alphanumeric).
- The public invoice page is mobile-optimized for the recipient.
- Designed for **instant WhatsApp sharing** — one tap → "Share via WA" with prefilled message.
- Invoice records ledger entry automatically when marked as paid.
- Statuses: `Draft → Sent → Paid → Void`.
- **Per-business sequential numbering** alongside the secure hash — e.g. `INV-2026-0001` for accounting / LHDN audit, hash for the share URL. Numbering scheme is `INV-{YYYY}-{NNNN}` by default; reset cadence (annual vs continuous) configurable per business.
- **SST line:** if SST is enabled in business settings (flat percent), each line item shows the calculated SST and the invoice total separates Subtotal / SST / Grand Total.

### 2.3 Universal "Pay Now" Panel on Invoice URL
A frictionless payment surface that **does not require the owner to have an FPX merchant account**, Billplz, Stripe, or any payment gateway.

- The recipient's invoice URL renders a **Pay Now** panel showing:
  - Owner's **DuitNow ID** (mobile / NRIC / SSM business reg number — registered once during onboarding).
  - The exact **amount** (= invoice grand total).
  - A **reference** (= invoice number, e.g. `INV-2026-0001`).
- Each field has a **tap-to-copy** button.
- Recipient pastes into their banking app's **DuitNow Transfer** screen → confirms → funds land directly in the owner's bank account. **Free, instant, no merchant account on either side.**
- Reconciliation in v1: customer messages "paid", owner taps **Mark Paid** on the invoice and pastes the bank reference. Same as today, but the "what's your account?" friction is gone.
- Owner registers the DuitNow ID **once** during onboarding (the registration itself is done in the owner's banking app — Bantu Niaga only stores the ID string).

> **FPX, credit cards, e-wallets, and dynamic DuitNow QR-with-amount are NOT in v1 core.** They require a merchant account (Billplz / Curlec / Stripe / iPay88) and will ship as the **Payment Gateway Connector** add-on, layered on top of this same Pay Now panel.

### 2.4 Quote → Invoice Converter
Removes the most common copy-paste error in micro-SME workflows.

- From any **Quotation** document (Admin Document Template) tagged as accepted, owner taps **Convert to Invoice**.
- A new Invoice is created with line items, client details, and totals **prefilled** from the quotation. Owner can edit before saving.
- The original Quotation gets a `linked_invoice_id` back-reference for audit.

### 2.5 Late-Payment Reminder Generator
Recovers cash without the owner having to cringe-write a chase message.

- When an invoice is past its `due_at`, the invoice card shows a **Send Reminder** button.
- The button generates a polite, ready-to-send WhatsApp script in **BM** (default) or **EN** (toggle), containing the invoice number, amount, due date, and the same Pay Now URL.
- One tap copies the script to clipboard and opens WhatsApp with the recipient prefilled. Owner reviews and sends.
- Sent reminders are logged on the invoice; subsequent reminders escalate tone (gentle → firm → final).
- Pure script-generation: no automation, no AI cost. (An automated, AI-tuned escalation lives in the future Finance AI Agent.)

## 3. Marketplace Add-ons

| Add-on | Price | What it unlocks |
|--------|------:|-----------------|
| **Full Ledger Analytics Suite** | +RM25/mo | Formal **Balance Sheet**, **multi-account reconciliations**, structural **Profit & Loss (P&L) reports**. |
| **LHDN Tax & E-Invoicing Exporter** | +RM35/mo | Pre-formats business datasets into XML schemas compliant with Malaysia's mandatory e-invoicing laws. Maps data onto **Form B / Form P** schedules. |

## 4. Data Model Sketch

```
Business
 ├── accounts[]                 (cash, bank, e-wallet) — needed for reconciliation add-on
 ├── transactions[]
 │    ├── id, type: REVENUE|EXPENSE
 │    ├── amount_myr, category, vendor_or_source
 │    ├── account_id, payment_method
 │    ├── occurred_at, receipt_file_id
 │    └── linked_invoice_id (nullable)
 └── invoices[]
      ├── id, share_hash, idcompany
      ├── client_name, client_contact
      ├── line_items[] { description, qty, unit_price, subtotal }
      ├── total_myr, tax_myr, grand_total_myr
      ├── status: DRAFT|SENT|PAID|VOID
      ├── issued_at, due_at, paid_at
      └── lhdn_xml_export_id (nullable, add-on)
```

## 5. Key User Flows

### 5.1 Send an invoice in under a minute
1. Owner taps **New Invoice**.
2. Picks/adds client → adds line items → reviews total.
3. Tap **Generate** → secure URL created.
4. Tap **Share via WhatsApp** → message + link prefilled.
5. When client pays, owner taps **Mark Paid** → ledger entry auto-created.

### 5.2 Record an expense from a receipt
1. Owner taps **+ Expense** → snaps photo of receipt.
2. Enters amount, picks category, picks account.
3. Saves → entry appears in ledger; receipt photo stored under Admin Storage.

### 5.3 LHDN export (add-on)
1. Owner opens **Finance → LHDN Exporter**.
2. Picks period (month / quarter / YA).
3. System maps transactions to Form B/P schedule.
4. Generates **XML** file compliant with LHDN e-invoicing schema.
5. Owner downloads XML and submits via MyTax or hands to agent.

## 6. Open Questions

- Multi-currency — out of scope for v1?
- Does paid status of an invoice trigger anything in Operations (e.g. stock decrement via the Micro Stock Tracker add-on)? **Yes — see Operations pillar.**
- Bank import / CSV ingestion — base or add-on? _(Currently planned as a future add-on.)_
- Audit trail / immutability of ledger entries once exported.
- Recurring invoices (subscriptions, retainers) — base or add-on? _(Currently planned as a future add-on.)_

> Resolved (now in core, v2026-06-12): SST flat-field handling · Per-business invoice numbering (`INV-2026-0001`).
