/**
 * Extract a human-readable message from our API error JSON shapes.
 */
export function apiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;

  const obj = json as Record<string, unknown>;

  const issues = obj.issues;
  if (Array.isArray(issues) && issues[0] && typeof issues[0] === "object") {
    const msg = (issues[0] as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }

  if (typeof obj.message === "string" && obj.message.length > 0) {
    return obj.message;
  }

  const err = obj.error;
  if (typeof err === "string" && err.length > 0) return err;
  if (err && typeof err === "object") {
    const nested = err as { message?: unknown; code?: unknown };
    if (typeof nested.message === "string" && nested.message.length > 0) {
      return nested.message;
    }
    if (typeof nested.code === "string" && nested.code.length > 0) {
      return nested.code;
    }
  }

  return fallback;
}
