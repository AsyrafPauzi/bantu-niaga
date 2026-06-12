/**
 * Cross-pillar event bus types.
 *
 * Events are persisted to `events_outbox` inside the same SQL transaction
 * that mutates the source entity, then dispatched to listeners. Some
 * listeners run synchronously (in-transaction); others run async (queued).
 *
 * See `docs/architecture/cross-pillar-sync.md` for the full event map.
 */

export type EventName =
  // Finance + Sales
  | "invoice.sent"
  | "invoice.paid"
  | "transaction.recorded"
  // Operations
  | "order.delivered"
  | "booking.confirmed"
  | "booking.completed"
  | "stock.low"
  // Sales / Marketing
  | "lead.captured"
  | "lead.converted"
  | "customer.created"
  | "customer.merged"
  | "customer.tag_changed"
  | "customer.updated"
  | "customer.deleted"
  // HR
  | "leave.approved"
  | "leave.rejected"
  | "payroll.approved"
  // Admin
  | "task.due_soon"
  | "compliance.due_soon";

export interface DomainEvent<TPayload = unknown> {
  id: string;
  business_id: string;
  name: EventName;
  payload: TPayload;
  emitted_by_user_id: string | null;
  emitted_at: string;
}

// Strongly-typed payloads for the events that already have settled shapes.
// Other event payloads will be filled in as their pillars implement.

export interface InvoicePaidPayload {
  invoice_id: string;
  invoice_number: string;
  total_myr: number;
  payment_method: "cash" | "duitnow_qr" | "duitnow_transfer" | "gateway";
  paid_at: string;
  /**
   * Customer FK from `invoices.customer_id`. **NEW for M6**; Marketing's
   * `invoice.paid` listener uses this to route the metric update.
   *
   * Nullable for backwards compatibility — Finance may still emit
   * historic invoices without a customer link (cash walk-in). When null,
   * the M6 listener marks the event as `skipped_no_customer` rather than
   * erroring.
   *
   * Tracked in plan §3.3 as dependency D2 (owned by Finance).
   */
  customer_id?: string | null;
  /**
   * Tenant scope. Mirrors `events_outbox.business_id` for handler-side
   * cross-business verification (M6 listener rejects if it disagrees).
   */
  business_id?: string;
  line_items: Array<{
    product_id: string | null;
    qty: number;
    unit_price_myr: number;
    subtotal_myr: number;
  }>;
}

/**
 * `order.delivered` payload (plan §3.2.2).
 *
 * Emitted by Operations when an order ships / is delivered. Marketing
 * uses it to bump `customers.total_spend_myr / order_count /
 * last_purchase_at`. When `invoice_id` is non-null and the matching
 * `invoice.paid` has already been processed, the listener skips this
 * event to avoid double-counting (the invoice is authoritative).
 *
 * Tracked in plan §3.3 as dependency D3 (owned by Operations).
 */
export interface OrderDeliveredPayload {
  order_id: string;
  customer_id: string | null;
  invoice_id: string | null;
  business_id?: string;
  total_myr: number;
  delivered_at: string;
  line_items: Array<{
    product_id: string | null;
    qty: number;
    unit_price_myr: number;
    subtotal_myr: number;
  }>;
}

/**
 * `booking.completed` payload (plan §3.2.3).
 *
 * Emitted by Operations when a service booking is marked complete.
 * Identical metric-update pattern to `order.delivered`; same
 * invoice-look-aside dedup rule.
 *
 * Tracked in plan §3.3 as dependency D4 (owned by Operations).
 */
export interface BookingCompletedPayload {
  booking_id: string;
  customer_id: string | null;
  invoice_id: string | null;
  business_id?: string;
  service_total_myr: number;
  completed_at: string;
}

/**
 * `lead.converted` payload (plan §3.2.4).
 *
 * Emitted by Sales when a lead is converted to a customer. The actual
 * customer record is created by Sales' convert-to-customer flow
 * (which POSTs `/api/marketing/customers` synchronously); this event
 * is informational/analytical from Marketing's POV — the listener
 * records the link in `marketing_event_dedup` for audit but performs
 * no metric mutation (the customer has no purchase history yet on
 * conversion).
 *
 * Tracked in plan §3.3 as dependency D5 (Sales — Asyraf-owned).
 */
export interface LeadConvertedPayload {
  lead_id: string;
  /** Surviving customer id (set by Sales after the Marketing API call). */
  customer_id: string | null;
  business_id?: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  note: string | null;
  converted_at: string;
}

/**
 * `customer.created` payload.
 *
 * Source values mirror the CHECK constraint on `customers.source`. The
 * `"public_booking_page"` variant is a Marketing M1 addition (decisions
 * doc, assumption #13).
 */
export type CustomerSource =
  | "pos"
  | "booking"
  | "lead_conversion"
  | "csv_import"
  | "manual"
  | "public_booking_page";

export interface CustomerCreatedPayload {
  customer_id: string;
  phone_e164: string | null;
  name: string;
  source: CustomerSource;
}

/**
 * `customer.merged` payload (plan §3.1.2).
 *
 * Fires when phone-dedup auto-merges a freshly-created customer into an
 * existing record, OR when an owner confirms a manual merge from the CRM.
 */
export interface CustomerMergedPayload {
  surviving_customer_id: string;
  discarded_customer_id: string;
  matched_on: "phone_exact" | "manual_prompt";
  actor_user_id: string | null;
  merged_at: string;
}

/**
 * `customer.tag_changed` payload (plan §3.1.3).
 *
 * Fires exclusively from the nightly auto-segmentation Edge Function, and
 * only when the computed `auto_tags` differ from the stored value. Manual
 * tag edits do NOT emit this event in v1.
 */
export interface CustomerTagChangedPayload {
  customer_id: string;
  prior_auto_tags: string[];
  new_auto_tags: string[];
  added: string[];
  removed: string[];
  computed_at: string;
  run_id: string;
}

/**
 * `customer.updated` payload (plan §3.1.4).
 *
 * Emitted on CRM field edits via the desktop CRM. Excludes derived-field
 * churn (purchase metrics) and auto_tags transitions (covered by
 * `customer.tag_changed`). Cheap to ship in v1 even though no consumer
 * exists yet (decisions doc, assumption #7).
 */
export type CustomerUpdatedField =
  | "name"
  | "email"
  | "address"
  | "manual_tags"
  | "notes"
  | "phone_e164";

export interface CustomerUpdatedPayload {
  customer_id: string;
  changed_fields: CustomerUpdatedField[];
  actor_user_id: string | null;
}

/**
 * `customer.deleted` payload (Marketing M2).
 *
 * Emitted from the `DELETE /api/marketing/customers/[id]` route handler
 * when an operator soft-deletes a customer record (sets `deleted_at`).
 * Foreign keys from Finance / Operations / Sales are NOT re-pointed
 * — the customer row stays referenceable; default API GETs simply hide
 * tombstoned rows.
 *
 * @see docs/plans/marketing-decisions.md Q8
 */
export interface CustomerDeletedPayload {
  customer_id: string;
  business_id: string;
  deleted_at: string;
  actor_user_id: string | null;
}

export interface StockLowPayload {
  product_id: string;
  current_count: number;
  safety_line: number;
}
