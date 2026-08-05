# Cross-Module Integration Map

> **Last updated:** 2026-08-05 (event bus + ops deploy)  
> **Purpose:** Single reference for how Bantu Niaga modules connect to each other — what is **done**, **pending**, or **not planned**.  
> **Companion:** [`CHECKLIST.md`](./CHECKLIST.md) tracks feature completion per pillar; this doc tracks **edges between pillars**.

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not done · — N/A by design · 🏪 Marketplace add-on (deferred)

---

## Summary matrix

| From → To | Admin | Finance | Operations | Sales | Marketing | HR | Settings | Home |
|-----------|-------|---------|------------|-------|-----------|-----|----------|------|
| **Admin Storage** | ✅ Tasks, Compliance | ✅ Expense, Invoice attach | ✅ Supplier, Order, Spec | ✅ Leads | — Bridge link | ✅ Docs, MC vault | ✅ Quota tier | ✅ Snapshot |
| **Finance** | ✅ Invoice docs | — | ✅ Order → expense | ✅ POS · Quotes on lead | ✅ Customers | — | ✅ Billing | ✅ Snapshot |
| **Operations** | ✅ File attach | ✅ Auto + manual expense | — | ✅ Auto + manual lead | — | ✅ Leave → bookings | — | ✅ Snapshot |
| **Sales** | ✅ Lead file | ✅ POS · void · Quote FK | ✅ Catalog · stock | — | ✅ Convert · coupon · POS | — | — | ✅ Snapshot |
| **Marketing** | — Separate bucket | — | — | ✅ Convert lead | — | — | — | ✅ Snapshot |
| **HR** | ✅ Docs · MC vault | — | ✅ Leave blocks calendar | — | — | — | ✅ Team roles | ✅ Snapshot |

---

## 1. Admin Storage (`admin_files`) — central document vault

Admin Storage is the shared back-office file vault. Other modules link via `admin_file_id` (or `spec_file_id` on products) FK, same `business_id`, RLS-scoped.

### 1.1 Inbound links (who attaches files)

| Source module | Entity | Column | UI | Status |
|---------------|--------|--------|-----|--------|
| Admin · Tasks | `admin_tasks` | `admin_file_id` | Task detail picker | ✅ |
| Admin · Compliance | `admin_compliance_items` | `admin_file_id` | Compliance upload | ✅ |
| HR · Documents | `hr_employee_documents` | `admin_file_id` | HR form + Storage | ✅ |
| HR · MC (new uploads) | `hr_leave_records` | `admin_file_id` | Staff leave MC upload | ✅ |
| Finance · Expenses | `finance_transactions` | `admin_file_id` | Expense receipt attach | ✅ |
| Finance · Invoices | `finance_invoices` | `admin_file_id` | Invoice composer attachment | ✅ |
| Operations · Suppliers | `operations_suppliers` | `admin_file_id` | Supplier card attach | ✅ |
| Operations · Orders | `operations_orders` | `admin_file_id` | Order card attach | ✅ |
| Operations · Products | `operations_products` | `spec_file_id` | Product spec sheet attach | ✅ |
| Sales · Leads | `sales_leads` | `admin_file_id` | Lead detail attach | ✅ |

### 1.2 Outbound “Used by” links (`loadFileUsageLinks`)

| Link type | Label | Deep link |
|-----------|-------|-----------|
| `compliance` | Licence | `/admin/compliance?item={id}` |
| `hr` | HR | `/hr/employees/{id}` |
| `task` | Task | `/admin/tasks?task={id}` |
| `finance` | Expense | `/finance/expenses?txn={id}` |
| `finance_invoice` | Invoice | `/finance/invoices/{id}/edit` |
| `operations_supplier` | Supplier | `/operations/suppliers?supplier={id}` |
| `operations_order` | Order | `/operations/orders?order={id}` |
| `operations_product` | Product spec | `/operations/products?product={id}` |
| `sales_lead` | Lead | `/sales/leads/{id}` |

### 1.3 Cross-pillar file picker

| Item | Path | Status |
|------|------|--------|
| Picker API | `GET /api/admin/storage/picker` | ✅ |
| Shared attach component | `components/admin/AdminStorageFileAttach.tsx` | ✅ |
| Cross-pillar download | `GET /api/admin/storage/[id]/download` | ✅ |
| Marketing bridge (separate bucket) | Admin Storage panel → `/marketing/content` | ✅ |

### 1.4 Not in Admin Storage (by design)

| Module | Where files live | Notes |
|--------|------------------|-------|
| Marketing | `marketing-media` / `marketing_files` | Bridge link only — not vault |
| HR MC (legacy rows) | `mc_document_path` only | New uploads also get `admin_file_id`; run `npm run backfill:mc-admin-files` for old rows |

---

## 2. Admin internal connections

| Connection | Mechanism | Status |
|------------|-----------|--------|
| Compliance → renewal prep task | Create task from compliance item | ✅ |
| Amir reads Finance receipt gaps | `lib/ai/context/admin.ts` | ✅ |
| Amir reads Ops low stock | Admin snapshot attention + KPI | ✅ |
| Aiman reads Ops low stock | `lib/ai/context/operations.ts` + notifications | ✅ |
| Storage quota from plan | `lib/admin/storage-quota.ts` | ✅ |

---

## 3. Finance ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Expense → Storage receipt | `finance_transactions.admin_file_id` | ✅ |
| Invoice supporting PDF in Storage | `finance_invoices.admin_file_id` | ✅ |
| Invoice payment → ledger txn | `finance_invoice_id` on txn | ✅ |
| POS checkout → finance txn | `lib/sales/checkout.ts` | ✅ |
| Quote → invoice | Finance convert flow | ✅ |
| Quote linked to Sales lead | `finance_invoices.sales_lead_id` + create from lead detail | ✅ |
| Customer invoices → Marketing customers | Shared `finance_customers` | ✅ |
| Manual expense from Operations order | `POST /api/operations/orders/{id}/record-expense` | ✅ |
| Invoice paid → ledger + stock + CRM | `invoice.paid` event (`dispatchInvoicePaid`) | ✅ |
| Auto expense when order → `done` | `recordExpenseFromOrder` in order PATCH | ✅ |
| `operations_order_id` on expense txn | Unique FK per order | ✅ |
| LHDN e-Invoice | Marketplace `lhdn-einvoice` | 🏪 Deferred |
| Recurring invoices | Marketplace `finance-recurring-invoices` | 🏪 Deferred |

**Key files:** `lib/operations/order-expense.ts`, `app/api/operations/orders/[id]/record-expense/route.ts`

---

## 4. Operations ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Order → supplier | `operations_orders.supplier_id` | ✅ |
| Supplier / order / product spec → Storage | `admin_file_id` / `spec_file_id` | ✅ |
| Product stock → POS | `operations_products` + `stock_qty` | ✅ |
| Service catalog → POS | `operations_services` | ✅ |
| Stock decrement on sale / restore on void | `stock.decrement` / `stock.restore` via event bus | ✅ |
| Invoice paid → stock decrement | `invoice.paid` → `stock.decrement` (lines with `product_id`) | ✅ |
| Booking → calendar | `operations_bookings` | ✅ |
| Manual expense from order | Order card “Record expense” | ✅ |
| Auto expense on order `done` | `order.completed` event → Finance handler | ✅ |
| Manual lead from order | `POST /api/operations/orders/{id}/create-lead` | ✅ |
| Auto lead on order create | `order.created` event (phone required) | ✅ |
| View linked lead on order | `sales_leads.source_order_id` lookup | ✅ |
| Low stock → Aiman / Amir | Notifications + AI snapshot | ✅ |
| Auto stock deduction (gated add-on) | Marketplace `auto-stock-deduction` | 🏪 Deferred |

**Key files:** `lib/operations/order-lead.ts`, `app/api/operations/orders/[id]/create-lead/route.ts`

---

## 5. Sales ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Lead → Storage proposal | `sales_leads.admin_file_id` | ✅ |
| Lead from Operations order | `sales_leads.source_order_id` | ✅ |
| Lead won → Marketing customer | `POST /api/sales/leads/[id]/convert` | ✅ |
| Lead → POS (post-convert) | `/sales/pos?customer_id=…` | ✅ |
| Marketing coupon → POS checkout | `coupon_code` on checkout | ✅ |
| Operations products / services → POS | POS grid APIs | ✅ |
| Stock decrement / restore on sale / void | `sale.completed` / `sale.voided` → `stock.*` events | ✅ |
| Quote on lead (FK + create CTA) | `sales_lead_id` + `/finance/invoices/new?kind=quote&lead_id=` | ✅ |
| POS → Finance txn / void reversal | Event handlers | ✅ |
| Coupon ROI / campaign attribution | Marketplace `sales-coupon-tracking` | 🏪 Deferred |

**Key files:** `lib/sales/lead-quotes.ts`, `components/sales/LeadDetailClient.tsx`

---

## 6. Marketing ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Content media bucket | Separate from `admin_files` | — |
| Storage → Marketing bridge | Admin Storage panel callout | ✅ |
| Lead convert → customer | Sales convert flow | ✅ |
| Coupon redeem at POS | Sales checkout | ✅ |
| Customer → POS deep link | Marketing customer detail | ✅ |
| Metric events (`invoice.paid`, etc.) | Sync dispatcher → `marketing_apply_metric_event` RPC | ✅ |
| Customer lifecycle (`customer.*`) | Sync dispatcher ack + cron replay | ✅ |
| Campaign asset in Admin Storage | Not planned | — |

---

## 7. HR ↔ other modules

| Connection | How | Status |
|------------|-----|--------|
| Employee document → Storage | `hr_employee_documents.admin_file_id` | ✅ |
| MC document → Storage vault | `hr_leave_records.admin_file_id` (new uploads) | ✅ |
| MC legacy backfill | `npm run backfill:mc-admin-files` | ✅ |
| Leave → Operations bookings | `leave.approved` / `leave.rejected` events | ✅ |
| Booking API blocks staff on leave | When `operations_booking_resources.employee_id` set | ✅ |
| Resource ↔ employee UI | Staff picker on Bookings page | ✅ |
| Leave banner on calendar | `loadActiveLeaveBlocks` | ✅ |
| Payroll → Finance | Marketplace `hr-payroll-pack` | 🏪 Deferred |

**Key files:** `lib/hr/sync-leave-availability.ts`, `lib/operations/staff-availability.ts`, `lib/operations/leave-blocks.ts`

---

## 8. Settings & platform (cross-cutting)

| Connection | How | Status |
|------------|-----|--------|
| Plan tier → Storage quota | `lib/admin/storage-quota.ts` | ✅ |
| Team RBAC → all modules | `lib/permissions.ts` | ✅ |
| Marketplace add-ons → module unlock | Plan gating | ✅ |
| Home dashboard snapshots | `lib/home/load-snapshot.ts` | ✅ |
| PDPA export includes all pillars | `lib/privacy/export-bundle.ts` | ✅ |
| Full cross-pillar event bus / outbox | ✅ Unified dispatcher + cron replay | `lib/events/dispatcher.ts` |

---

## 9. AI assistants (cross-pillar awareness)

| Agent | Pillar | Reads other modules | Status |
|-------|--------|---------------------|--------|
| Amir | Admin | Compliance, Storage gaps, Finance receipt gaps, Ops low stock | ✅ |
| Fayza | Finance | Invoices, transactions | ✅ |
| Aiman | Operations | Orders, stock, bookings | ✅ |
| Maya | Marketing | Content, customers | ✅ |
| Hana | HR | Employees, leave | ✅ |
| Boardroom | All | Pillar snapshots | ✅ |

---

## 10. Event bus (cross-pillar)

| Event | Emitter | Handler | Effect |
|-------|---------|---------|--------|
| `sale.completed` | POS checkout | Finance income + `stock.decrement` | Ledger + inventory |
| `sale.voided` | POS void | Finance reversal + `stock.restore` | Undo ledger + inventory |
| `stock.decrement` | `sale.completed` (nested) | Operations | `decrementProductStock` |
| `stock.restore` | `sale.voided` (nested) | Operations | `restoreProductStock` |
| `leave.approved` / `leave.rejected` | HR leave status | Operations | Availability blocks |
| `order.completed` | Order → `done` | Finance | Expense from order |
| `order.created` | Order create | Sales | Auto lead (phone required) |
| `invoice.paid` | Finance mark paid / Billplz | Finance + stock + Marketing | Ledger + inventory + CRM metrics |
| `invoice.paid` / `order.delivered` / `booking.completed` / `lead.converted` | Various | Marketing RPC | Customer spend metrics |
| `customer.created` / `updated` / `deleted` / `merged` / `tag_changed` | CRM / SQL | Sync ack | Audit / Home feed |

**Dispatcher:** `lib/events/dispatcher.ts` · **Handlers:** `lib/events/register-handlers.ts`  
**Cron replay:** `GET /api/cron/events-dispatch` (daily 02:00 UTC on Hobby; invoke manually for faster replay)  
**Legacy:** `marketing-event-listener` Edge function remains as optional batch fallback

---

## 11. API quick reference (cross-module)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/operations/orders/{id}/record-expense` | Manual expense from order |
| `POST /api/operations/orders/{id}/create-lead` | Create or return lead for order |
| `PATCH /api/operations/orders/{id}` | Status change; auto-expense on `done` |
| `POST /api/operations/orders` | Create order; auto-lead if phone present |
| `GET /finance/invoices/new?kind=quote&lead_id=` | Create quote for lead |
| `GET /finance/expenses?txn=` | Deep link to expense row |

---

## 12. Migrations

| Migration | Purpose |
|-----------|---------|
| `20260730280000_cross_pillar_admin_file_links.sql` | Finance, Ops, Sales ↔ Storage |
| `20260731010000_finance_billplz_and_invoice_attachments.sql` | Invoice `admin_file_id` |
| `20260805180000_cross_module_bridges.sql` | Spec sheets, order expense FK, lead quote FK, MC vault, leave blocks, resource `employee_id` |
| `20260805190000_cross_module_polish.sql` | `sales_leads.source_order_id`, resource employee index |

| `20260805200000_cross_pillar_event_dispatcher.sql` | Outbox index for cross-pillar cron |
| `20260805210000_invoice_items_product_id.sql` | Invoice line `product_id` + handler dedup |
| `20260805220000_extend_cross_pillar_event_index.sql` | Index incl. `invoice.paid` + `customer.*` |

Apply on remote: `npx supabase db push` ✅ (deployed 2026-08-05)

---

## 13. Still open (non-addon)

_All core cross-module bridges shipped._ Marketplace add-ons only (see §14).

---

## 14. Deferred — marketplace only 🏪

| Slug | Feature |
|------|---------|
| `lhdn-einvoice` | LHDN e-Invoice connector |
| `finance-recurring-invoices` | Recurring invoices |
| `hr-payroll-pack` | Payroll → Finance |
| `sales-coupon-tracking` | Coupon ROI / campaign attribution |
| `auto-stock-deduction` | Gated full auto stock (POS decrement already works) |

---

## 15. Not planned

| Item | Why |
|------|-----|
| Marketing campaign assets in Admin Storage | Separate `marketing-media` bucket by design |
| Per-business public holiday overrides | By design |

---

## 16. Ops scripts

| Command | Purpose |
|---------|---------|
| `npm run backfill:mc-admin-files` | Backfill `admin_file_id` for legacy MC rows ✅ (0 rows on prod) |
| `npm run backfill:mc-admin-files -- --dry-run` | Preview MC backfill without writing |

---

*Update this file whenever a new cross-module FK, API, or UI bridge ships.*
