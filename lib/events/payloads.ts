/** Payload for `invoice.paid` — Finance + Operations + Marketing listeners. */
export interface InvoicePaidPayload {
  business_id: string;
  invoice_id: string;
  invoice_number: string;
  total_myr: number;
  payment_method: "cash" | "duitnow_qr" | "duitnow_transfer" | "gateway" | "fpx" | "other";
  paid_at: string;
  customer_id?: string | null;
  customer_name?: string;
  actor_user_id?: string | null;
  created_by?: string | null;
  line_items: Array<{
    product_id: string | null;
    qty: number;
    unit_price_myr: number;
    subtotal_myr: number;
  }>;
}

/** Payload for `stock.decrement` — Operations inventory listener. */
export interface StockDecrementPayload {
  business_id: string;
  source_type: "sale" | "invoice" | "manual";
  source_id: string;
  lines: Array<{ product_id: string; quantity: number }>;
}

/** Payload for `stock.restore` — reverses a prior decrement. */
export interface StockRestorePayload {
  business_id: string;
  source_type: "sale" | "invoice" | "manual";
  source_id: string;
  lines: Array<{ product_id: string; quantity: number }>;
}

/** Payload for `leave.approved` / `leave.rejected`. */
export interface LeaveStatusPayload {
  business_id: string;
  leave_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string | null;
}

/** Payload for `order.completed` — Finance expense from Operations order. */
export interface OrderCompletedPayload {
  business_id: string;
  order_id: string;
  user_id: string;
  can_finance: boolean;
}

/** Payload for `order.created` — Sales lead from Operations order. */
export interface OrderCreatedPayload {
  business_id: string;
  order_id: string;
  user_id: string;
  can_leads: boolean;
  customer_phone?: string | null;
}

export type CrossPillarEventName =
  | "sale.completed"
  | "sale.voided"
  | "stock.decrement"
  | "stock.restore"
  | "leave.approved"
  | "leave.rejected"
  | "order.completed"
  | "order.created"
  | "invoice.paid";
