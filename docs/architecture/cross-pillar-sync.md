# Cross-Pillar Database Synchronization Framework

> Pillars are not silos. They share a unified relational PostgreSQL database, and a server-side **event bus** propagates state mutations across pillars so the system behaves like an automated corporate engine.

## 1. Principles

1. **Single source of truth.** Each entity (customer, invoice, product, employee) lives in one canonical table; other pillars reference by foreign key.
2. **Event-driven mutations.** Cross-pillar effects are triggered by domain events (`invoice.paid`, `payroll.approved`), not by direct cross-pillar writes.
3. **Idempotent handlers.** Every cross-pillar handler can be replayed safely — important for retry on transient failures.
4. **Atomic when it matters.** Money + stock movements happen inside a single SQL transaction; soft side-effects (notifications, AI summaries) are queued.
5. **Audit trail.** Every event is persisted (`events` table) with timestamp, actor, payload, and downstream effects — useful for debugging and LHDN audit.

## 2. Canonical Event Flow — Invoice Paid

The hero example of cross-pillar behavior:

```
              [ Sales Pillar: Invoice Marked Paid ]
                            |
        +-------------------+-------------------+
        |                                       |
        v                                       v
[ Finance Pillar ]                    [ Operations Pillar ]
 Auto-logs Cash Income                 Auto-deducts Stock Count
 Updates Tax-Ready Sheets              Triggers Low-Stock Alert (if add-on)
```

**Sequence:**

1. Cashier (or owner) marks invoice `status = PAID` in Sales or Finance UI.
2. `invoice.paid` event fires with payload `{ invoice_id, total_myr, line_items[], paid_at, payment_method }`.
3. **Finance handler:**
   - Creates a `transactions` row, type `REVENUE`, linked to the invoice.
   - Updates running cashflow totals and the Net Profit chart.
   - Tags transaction with LHDN category `Sales Income` (for future export).
4. **Operations handler:** _(only if Micro Stock Tracker add-on is active)_
   - For each line item, decrements `products.stock_count`.
   - If any new `stock_count < products.safety_line`, emits a `stock.low` event.
5. **Admin handler:**
   - Posts a notification to the Notification Feed: _"Invoice INV-XXXX paid · stock updated"_.

All four happen inside one transaction. If any handler fails, the entire transition rolls back.

## 3. Full Cross-Pillar Event Map

| Event | Emitter | Listeners | Effect |
|-------|---------|-----------|--------|
| `invoice.paid` | Sales / Finance | Finance, Operations, Admin | Cashflow logged · stock decremented · notification |
| `invoice.sent` | Finance | Admin | Notification: "Invoice sent to <client>" |
| `payroll.approved` | HR | Finance | Auto-creates `EXPENSE` row tagged `Staff Remuneration` (LHDN category) |
| `leave.approved` / `leave.rejected` | HR | Admin · (Self-Service add-on: email) | Notification · email to staff |
| `lead.captured` | Marketing (landing page) | Sales | New card appears in Sales Prospect CRM |
| `lead.converted` | Sales | Marketing | Creates Customer record in Marketing CRM; archives lead |
| `order.delivered` | Operations | Finance | Prompts owner to generate invoice (if not yet) |
| `booking.confirmed` | Operations | Finance · Marketing | Optional invoice generation · customer activity logged |
| `stock.low` | Operations | Admin · Operations AI (if active) | Notification · AI nudge to reorder |
| `task.due_soon` | Admin | Admin · Pillar AI (if active) | Notification · daily summary inclusion |
| `customer.created` | Sales / Marketing / POS | Marketing | Adds to Customer CRM, dedupes by phone |
| `transaction.recorded` | Finance | Finance AI (if active) | Aggregated into proactive morning dashboard |

## 4. Specific Sync Patterns

### 4.1 Sales → Finance → Operations
**Trigger:** invoice marked `PAID`.
**Why it matters:** the single most common workflow — keeps cash and stock honest in one tap.

### 4.2 HR → Finance
**Trigger:** owner approves monthly payroll batch in HR.
**Effect:** for each approved employee payslip, Finance creates an `EXPENSE` transaction.
- `category = "Staff Remuneration"` (mapped to LHDN deductible category).
- `account = "Bank"` (default; configurable).
- Linked back to `payslip_id` for audit.
**Notes:** statutory deductions (EPF/SOCSO/EIS) are computed by the HR add-on **Malaysian Statutory Payroll Deductions** — when active, each statutory portion is emitted as its own line and posted to Finance with appropriate LHDN categories. _(Note: the Malaysian Statutory Payroll Deductions item is described in the SME-OS project proposal; reconcile with the v1 add-on list before implementation.)_

### 4.3 Marketing → Sales
**Trigger:** a lead is captured via an external Marketing surface (landing page, social link form, etc.).
**Effect:** a `lead.captured` event creates a card in the Sales Prospect CRM with channel attribution.
- If the Sales pillar is locked (Starter/Micro tier), the lead is **buffered**: stored but not surfaced. Upon tier upgrade to SME, buffered leads appear in the pipeline.
- This is a one-way push; updating a Sales card doesn't write back to the Marketing landing page.

### 4.4 Operations → Marketing
**Trigger:** `order.delivered` or `booking.completed`.
**Effect:** Marketing CRM's customer record updates `last_purchase_at`, increments `order_count`, recalculates `total_spend`. This drives the customer cohort views and Promo Engine targeting.

### 4.5 Finance → Admin Storage
**Trigger:** receipt photo attached to an expense.
**Effect:** the file lives in Admin Storage with a sensitive flag and a back-reference (`transaction_id`). Counts against the user's storage tier.

## 5. Event Bus Architecture

A pragmatic in-process implementation for v1, with room to grow:

```
┌──────────────┐
│  HTTP API    │  (Next.js Route Handlers)
└──────┬───────┘
       │ writes
       v
┌──────────────┐      ┌──────────────────────┐
│  Postgres    │ ───▶ │  events_outbox       │  (transactional outbox)
│  (entities)  │      └──────┬───────────────┘
└──────────────┘             │
                             v
                  ┌────────────────────────┐
                  │  Event Dispatcher       │  (Node worker)
                  └─────┬─────────┬─────────┘
                        │         │
              sync hand-│         │ async fan-out
              lers (DB  │         │ (notifications, AI)
              transact) │         │
                        v         v
                 [Finance,    [Notification,
                  Operations,  Email,
                  Admin]       AI summary]
```

- **Transactional outbox pattern.** Domain events are written to `events_outbox` inside the same SQL transaction that mutates the entity. A worker reads the outbox and dispatches to listeners — at-least-once delivery.
- **Two listener classes:**
  - **Synchronous (in-transaction)** — Finance ledger writes, stock decrements. These must succeed atomically with the source event or rollback.
  - **Asynchronous (queued)** — notifications, AI summaries, emails. Allowed to be eventually consistent.

## 6. Multi-Tenancy & Isolation

- All tables include `business_id` (the `idcompany`'s internal UUID).
- Every cross-pillar handler is scoped to `business_id` — no event from Business A ever touches Business B's data.
- Row-level security (Postgres RLS) is the recommended enforcement layer. _(Decision pending — see Open Questions.)_

## 7. Failure Modes & Recovery

| Failure | Behavior |
|---------|----------|
| Sync handler throws (e.g. stock decrement underflow) | Transaction rolls back; invoice stays in previous status; UI surfaces error. |
| Async handler throws | Event re-queued with exponential backoff; max 5 retries; eventually goes to dead-letter for admin review. |
| Webhook from payment provider (DuitNow / Billplz) arrives after manual mark-as-paid | Idempotent: `invoice.paid` handler dedupes by `invoice_id` + `payment_reference`. |
| AI summary generation fails | Silent; the next-day summary picks up the missed event. Never blocks user workflow. |

## 8. Locked-Pillar Behavior

When a pillar is locked by tier (e.g. Sales on Starter):

- Events targeting that pillar are **buffered** (stored but no UI surfaced).
- Events emitted from that pillar are not generated (because the pillar UI doesn't exist).
- On upgrade, buffered events become visible.

This guarantees no data loss across upgrade/downgrade cycles.

## 9. Open Questions

- Final choice of event dispatcher: in-process Node worker vs. a managed queue (BullMQ, SQS, Redis Streams).
- Postgres RLS vs. application-layer tenant filtering.
- Long-term: should the outbox be replaced by Postgres logical replication / Debezium when scale demands it?
- Should certain cross-pillar effects be opt-out per business (e.g. "I don't want stock to auto-decrement; I prefer manual")?
- Retention policy for the `events_outbox` table (90 days? 1 year? forever for LHDN audit?).
