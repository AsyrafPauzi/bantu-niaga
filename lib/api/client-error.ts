/**
 * Map machine-readable API error codes to user-friendly sentences.
 * These are shown in toasts / inline feedback — never expose raw code to users.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  // HTTP layer
  unauthorized:
    "You need to be signed in to do that. Please refresh the page and sign in again.",
  forbidden: "You don't have permission to perform this action.",
  not_found: "The item you're looking for couldn't be found.",
  bad_request: "The request couldn't be completed — please check your inputs.",
  validation_failed: "Some fields have invalid values. Please review and correct them.",
  conflict: "This action conflicts with existing data. Please refresh and try again.",
  rate_limited:
    "You're doing that a bit too fast. Please wait a moment and try again.",
  internal_error:
    "Something went wrong on our end. Your data is safe — please try again in a few minutes.",

  // Auth
  invalid_credentials: "The email or password is incorrect. Please try again.",
  email_taken: "An account with that email already exists.",
  verification_email_failed:
    "We created your account but couldn't send the verification email. Please contact support.",

  // Billing / subscriptions
  subscription_past_due:
    "Your subscription payment is overdue. Please update your billing details to continue.",
  free_tier_limit:
    "You've reached the limit for your current plan. Upgrade to add more.",
  payment_failed:
    "We couldn't process the payment right now. Your subscription has not been changed. Please try again in a few minutes.",

  // Finance
  invoice_paid_dispatch_failed:
    "The invoice was marked paid but the ledger sync failed. Please check Finance → Transactions.",
  insufficient_stock:
    "One or more items don't have enough stock. Adjust the quantities and try again.",

  // Generic
  invalid_json: "The request couldn't be read. Please try again.",
};

/**
 * Extract a human-readable message from our API error JSON shapes.
 * Error codes are translated through ERROR_CODE_MESSAGES so users never
 * see raw technical codes or internal stack traces.
 */
export function apiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;

  const obj = json as Record<string, unknown>;

  // Check for error.code first — translate via our map.
  const err = obj.error;
  if (err && typeof err === "object") {
    const nested = err as { message?: unknown; code?: unknown };
    if (typeof nested.code === "string") {
      const mapped = ERROR_CODE_MESSAGES[nested.code];
      if (mapped) return mapped;
    }
    if (typeof nested.message === "string" && nested.message.length > 0) {
      return nested.message;
    }
  }

  // Flat `code` field on the root object.
  if (typeof obj.code === "string") {
    const mapped = ERROR_CODE_MESSAGES[obj.code];
    if (mapped) return mapped;
  }

  // Flat `error` string (older routes).
  if (typeof err === "string") {
    const mapped = ERROR_CODE_MESSAGES[err];
    if (mapped) return mapped;
  }

  // Zod validation issues — show the first field-level message.
  const issues = obj.issues ?? (err && typeof err === "object" ? (err as Record<string, unknown>).issues : undefined);
  if (Array.isArray(issues) && issues[0] && typeof issues[0] === "object") {
    const msg = (issues[0] as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }

  // Generic message field.
  if (typeof obj.message === "string" && obj.message.length > 0) {
    return obj.message;
  }

  return fallback;
}
