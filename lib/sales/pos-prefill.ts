/** Build POS URL with customer or lead pre-fill query params. */
export function buildPosPrefillUrl(opts: {
  customerId?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  leadPhone?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (opts.customerId) sp.set("customer_id", opts.customerId);
  if (opts.customerName?.trim()) sp.set("customer_name", opts.customerName.trim());
  if (opts.leadId) sp.set("lead_id", opts.leadId);
  if (opts.leadName?.trim()) sp.set("lead_name", opts.leadName.trim());
  if (opts.leadPhone?.trim()) sp.set("lead_phone", opts.leadPhone.trim());
  const qs = sp.toString();
  return qs ? `/sales/pos?${qs}` : "/sales/pos";
}
