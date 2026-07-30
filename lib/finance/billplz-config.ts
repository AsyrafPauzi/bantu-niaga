/** Lightweight Billplz flags — safe to import from pages (no server-only). */

export function isFinanceBillplzCheckoutEnabled(): boolean {
  const key = process.env.BILLPLZ_API_KEY?.trim();
  const collection = process.env.BILLPLZ_COLLECTION_ID?.trim();
  return Boolean(key && collection);
}

export function isFinanceBillplzWebhookEnabled(): boolean {
  return (
    isFinanceBillplzCheckoutEnabled() &&
    Boolean(process.env.BILLPLZ_X_SIGNATURE_KEY?.trim())
  );
}
