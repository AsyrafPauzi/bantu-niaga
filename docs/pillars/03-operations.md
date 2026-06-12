# Pillar 3 — Operations

> Move work from order → delivery; manage suppliers, products, bookings.

## 1. Goal & User

**Primary user:** the owner of a product or service business, plus optionally floor staff.
**Job to be done:** keep track of what's being produced, who supplies what, what's on the shelf, and — for service businesses — what's been booked.

## 2. Base Package Features

### 2.1 Order Fulfillment Pipeline
A **kanban pipeline tracker** monitoring production stages from order receipt to customer delivery.

- Default columns: `New Order → In Progress → Ready → Delivered`.
- **Columns are user-configurable** in v1 — owners can rename, reorder, add up to 8 columns total. Different segments need different stages (kafe ≠ kedai ≠ salon ≠ bakery).
- Each card = one order; links back to a Customer (Marketing CRM) and optionally an Invoice (Finance).
- Drag-and-drop on mobile, tap-to-update on small screens.
- Filter by status, date, customer.

### 2.2 Supplier Directory
Master contact list of vendors.

- Vendor record fields: name, contact, address, **payment terms** (e.g. NET 30, COD), notes.
- **Material cost log** per vendor — track what was bought, when, at what unit price; useful for COGS.

### 2.3 Product Manager
A catalog manager for standard physical inventory items.

- Fields: SKU, name, description, image, base price, group/category.
- Group products by category for the POS grid (Sales pillar) and pipeline.
- Note: actual stock counts are **not** in the Base Package — they live in the Micro Stock Tracker add-on.
- **Variants are supported in core** — one parent product can hold multiple variants (e.g. T-shirt → S/M/L; ikan → kg/ekor; kek → 1kg/2kg). Each variant has its own SKU, optional price override, and optional image override. Variants surface as sub-tiles on the POS grid.

### 2.4 Services & Booking Slot Manager
A calendar booking system for **time-allocated** or **reservation-based** businesses.

- Use cases: homestay nights, dynamic rental slots, beauty salon appointments, tuition classes.
- Define **Resources** (room, chair, vehicle, instructor) and **Service Types** (duration, price).
- Calendar views: day / week / month.
- Slot states: `Available → Held → Confirmed → Completed → Cancelled`.
- Each booking can be linked to a Customer (Marketing CRM) and generate an Invoice (Finance).
- **Buffer time per resource** — owner sets a buffer (e.g. 10 min salon turnover, 4 h homestay cleanup) that the calendar automatically blocks after every Confirmed booking. Booking slots that violate the buffer are visually disabled.

### 2.5 Customer-Facing Booking Page
Closes the booking loop for service businesses — customers self-book without messaging the owner.

- Public secure-hash URL pattern (same convention as invoices):
  ```
  bantuniaga.com/[idcompany]/book-[secure-random-hash]
  ```
  Example: `bantuniaga.com/intantrade/book-7m3q9f2p`
- One link per business; owner pastes it into TikTok / IG bio / WhatsApp.
- Customer flow: pick a Service Type → see available slots (driven by the Resources + buffer time logic above) → enter name + phone → confirm.
- On submission:
  - A `customer.created` event fires (deduped by phone via the Marketing CRM).
  - A booking is created with status `Held` (or `Confirmed`, configurable per business).
  - Owner gets a Notification Feed event.
  - Optional: owner can require a deposit before confirmation — surfaces the Pay Now panel from Finance.
- Owners can disable the public page or rotate the hash if they want to take it offline.

## 3. Marketplace Add-ons

| Add-on | Price | What it unlocks |
|--------|------:|-----------------|
| **Micro Stock Tracker & Low-Stock Alarms** | +RM20/mo | Syncs inventory directly to sales pipelines. Automatically **decreases product stock counts** when an invoice is **paid**. Fires **alerts** when stock dips below configured safety lines. |

## 4. Data Model Sketch

```
Business
 ├── orders[]
 │    ├── id, customer_id (Marketing), invoice_id (Finance, nullable)
 │    ├── status: NEW|IN_PROGRESS|READY|DELIVERED
 │    ├── line_items[] (refs products)
 │    └── created_at, delivered_at
 ├── suppliers[]
 │    ├── id, name, contact, address
 │    ├── payment_terms
 │    └── material_log[] { product_id, unit_cost, qty, purchased_at }
 ├── products[]
 │    ├── id, sku, name, description, image_file_id
 │    ├── group / category
 │    ├── base_price_myr
 │    └── stock_count       ← only populated when Micro Stock Tracker add-on active
 ├── resources[]              (for booking)
 │    └── id, name, type, color
 └── bookings[]
      ├── id, resource_id, service_type_id, customer_id
      ├── starts_at, ends_at
      ├── status: AVAILABLE|HELD|CONFIRMED|COMPLETED|CANCELLED
      └── invoice_id (nullable)
```

## 5. Key User Flows

### 5.1 Take an order through the pipeline
1. Customer order arrives (via WA, call, walk-in).
2. Owner adds card to **New Order** column; picks customer + line items.
3. Drags card across columns as work progresses.
4. On **Delivered**, owner can generate an invoice in one tap.

### 5.2 Add a supplier with cost log
1. Operations → Suppliers → **+ New**.
2. Fill name, contact, terms.
3. After purchase, log the material entry: product, qty, unit cost — used for COGS reporting.

### 5.3 Book a homestay night
1. Owner opens **Bookings → Calendar**.
2. Picks resource (room) + date range.
3. Confirms customer details → status **Confirmed**.
4. Generates invoice → shares URL via WhatsApp.

### 5.4 Stock alarm fires (with add-on)
1. Customer pays invoice → status `Paid`.
2. Micro Stock Tracker decrements stock for each line item.
3. If `stock_count` drops below `safety_line`, a notification appears in the Admin Notification Feed.

## 6. Open Questions

- Service businesses with **recurring bookings** (weekly tuition classes, gym sessions) — supported in v1, or future add-on? _(Currently planned as a future add-on.)_
- Multi-resource bookings (e.g. one customer books a room + a tour at the same time)?
- Reorder workflow when low-stock alarm fires — manual, or does the system draft a PO? _(Auto-PO planned as a future add-on.)_
- Customer-facing booking page: bot/abuse protection (rate limit per phone? captcha?).

> Resolved (now in core, v2026-06-12): Configurable pipeline columns · Product variants · Buffer time between bookings · Customer-facing public booking page.
