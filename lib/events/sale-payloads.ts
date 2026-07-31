/** Payload for `sale.completed` — Finance + Operations listeners. */
export interface SaleCompletedPayload {
  sale_id: string;
  sale_number: string;
  business_id: string;
  cashier_user_id: string;
  customer_id: string | null;
  customer_name: string | null;
  total_myr: number;
  payment_method: "cash" | "duitnow_qr_static";
  completed_at: string;
  line_items: Array<{
    product_id: string | null;
    service_id: string | null;
    product_name: string;
    quantity: number;
    line_total_myr: number;
  }>;
}

/** Payload for `sale.voided` — reverses Finance + Operations effects. */
export interface SaleVoidedPayload {
  sale_id: string;
  sale_number: string;
  business_id: string;
  voided_by_user_id: string;
  voided_at: string;
  finance_transaction_id: string | null;
  line_items: Array<{
    product_id: string | null;
    quantity: number;
  }>;
}

export type SaleEventName = "sale.completed" | "sale.voided";
