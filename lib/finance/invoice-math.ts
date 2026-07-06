export interface InvoiceLineInput {
  unit_price: number;
  quantity: number;
  taxable?: boolean;
}

export interface InvoiceTotalsInput {
  items: InvoiceLineInput[];
  discount_myr?: number;
  discount_pct?: number;
  tax_myr?: number;
  tax_pct?: number;
  shipping_myr?: number;
}

export interface InvoiceTotals {
  amount_myr: number;
  discount_myr: number;
  tax_myr: number;
  shipping_myr: number;
  total_myr: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function lineTotal(unitPrice: number, quantity: number): number {
  return round2(unitPrice * quantity);
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  let discount = input.discount_myr ?? 0;
  if ((input.discount_pct ?? 0) > 0) {
    discount = subtotal * ((input.discount_pct ?? 0) / 100);
  }

  const afterDiscount = Math.max(0, subtotal - discount);

  const taxableBase = input.items.reduce(
    (sum, item) =>
      item.taxable ? sum + item.unit_price * item.quantity : sum,
    0,
  );

  let tax = input.tax_myr ?? 0;
  if ((input.tax_pct ?? 0) > 0) {
    const taxBase = taxableBase > 0 ? taxableBase : afterDiscount;
    tax = taxBase * ((input.tax_pct ?? 0) / 100);
  }

  const shipping = input.shipping_myr ?? 0;
  const total = afterDiscount + tax + shipping;

  return {
    amount_myr: round2(subtotal),
    discount_myr: round2(discount),
    tax_myr: round2(tax),
    shipping_myr: round2(shipping),
    total_myr: round2(total),
  };
}
