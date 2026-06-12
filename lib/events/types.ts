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
  line_items: Array<{
    product_id: string | null;
    qty: number;
    unit_price_myr: number;
    subtotal_myr: number;
  }>;
}

export interface CustomerCreatedPayload {
  customer_id: string;
  phone_e164: string | null;
  name: string;
  source: "pos" | "booking" | "lead_conversion" | "csv_import" | "manual";
}

export interface StockLowPayload {
  product_id: string;
  current_count: number;
  safety_line: number;
}
