# Module 5 — Sales

> Close sales fast and never lose a lead.

## 1. Purpose

Sales helps owners manage potential customers and take simple counter payments. Core should be quick enough for a phone or tablet at the counter. Advanced approvals, hardware, offline mode, and detailed sales analytics belong in add-ons.

## 2. Target Users

- Solo entrepreneurs who need a simple lead list and quick sale record.
- Micro SMEs with basic counter sales or service sales.
- Growing SMEs that later need cashier controls, staff sales reports, reconciliation, and hardware support.

## 3. Core Features (included)

Core Sales covers **lead tracking** and **simple counter POS** — paid-in-full, phone/tablet friendly:

| Feature | Notes |
|---------|--------|
| Lead pipeline | Statuses: new → contacted → interested → won / lost |
| Lead notes + follow-up | Chase list without losing WhatsApp / walk-in leads |
| Convert lead → customer | Writes into Marketing CRM (not a separate customer book) |
| Mobile POS | Product grid from Operations catalog |
| Payments (core) | Cash + **static** DuitNow QR only |
| Basic receipt | Subtotal / SST (if enabled) / total |
| Daily sales summary | Today’s take for the owner |

**Not core:** Dynamic DuitNow, refund/void approval, close-out, staff reports, offline, hardware, storefront, stale-lead alerts, Sales AI (Sufi).

## 4. Add-on Features (Marketplace · efficiency & control)

| Add-on | Role |
|--------|------|
| Sales AI (Sufi) | Staff planner for floor / leads — like Maya/Hana |
| Dynamic DuitNow QR | Amount-specific QR |
| Refund & Void Approval | Manager control + ledger reversal |
| Daily Close-Out Reconciliation | End-of-day cash vs system |
| Sales by Staff Report | Cashier performance |
| Coupon-to-Sales Tracking | Promo ROI with Marketing |
| Hardware POS Extensions | Barcode / thermal printer |
| Offline POS Mode | Network drop queue |
| Online Storefront | Public shop |
| Stale Lead Alerts | Auto chase |

All Sales add-ons stay **coming soon** until Sales core is settled (see team-direction §3.5).

## 5. Key User Flows

### 5.1 Capture a lead

1. Owner adds a lead from WhatsApp, Instagram, referral, walk-in, or call.
2. Owner records interest, value estimate, and notes.
3. Owner sets follow-up reminder.
4. Owner updates lead status until won or lost.

### 5.2 Take a POS sale

1. Cashier opens POS.
2. Cashier taps products from the grid.
3. Cashier chooses cash or static DuitNow QR.
4. System creates a sale record and basic receipt.
5. Finance receives the sales amount for reporting.

### 5.3 Convert lead to customer

1. Owner marks a lead as won.
2. Owner converts the lead into a customer.
3. Customer is stored in Marketing CRM.
4. Sale or future invoice can be linked back to the original lead.

## 6. Data Notes

Core tables should cover leads, lead notes, lead statuses, POS sales, sale items, payment method, receipt data, and customer links. Core POS should stay paid-in-full and simple.

Premium add-ons can extend the model with approvals, refunds, voids, close-outs, cashier reports, dynamic QR payloads, barcode records, hardware state, offline sync queue, storefront orders, stale lead jobs, and AI-generated follow-up notes.
