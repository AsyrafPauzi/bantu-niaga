import { isBillplzConfigured } from "@/lib/settings/billing";

export class BillplzNotConfiguredError extends Error {
  readonly code = "billplz_not_configured" as const;

  constructor() {
    super("Billplz is not configured for paid checkout.");
    this.name = "BillplzNotConfiguredError";
  }
}

/** Production must have Billplz for any paid money path. */
export function assertBillplzConfiguredForPaidCheckout(): void {
  if (process.env.NODE_ENV === "production" && !isBillplzConfigured()) {
    throw new BillplzNotConfiguredError();
  }
}
