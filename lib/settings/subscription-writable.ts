export class SubscriptionPastDueError extends Error {
  readonly code = "subscription_past_due" as const;

  constructor(
    message = "Payment overdue. Pay to continue creating invoices and sales.",
  ) {
    super(message);
    this.name = "SubscriptionPastDueError";
  }
}

/** Mutating finance/sales/marketplace actions allowed when true. */
export function isSubscriptionWritable(status: string): boolean {
  return status === "active" || status === "trial";
}

export function assertSubscriptionWritable(status: string): void {
  if (!isSubscriptionWritable(status)) {
    throw new SubscriptionPastDueError();
  }
}
