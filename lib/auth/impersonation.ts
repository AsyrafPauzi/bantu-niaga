/**
 * Bantu Niaga — impersonation primitives.
 *
 * When a platform admin clicks "Impersonate" on a tenant user, we set a
 * server-readable cookie that carries the target user id. The tenant app
 * then resolves the *target* user instead of the platform admin for every
 * server-side data fetch, so the admin sees exactly what the customer
 * sees.
 *
 * Security model:
 *   - The cookie is httpOnly + signed-by-design (it only carries a uuid;
 *     verifying the impersonation row still happens on every read).
 *   - Mutations performed during impersonation are gated by an
 *     `IMPERSONATION_ALLOWS_WRITES` flag (default: false). Set to true
 *     only when the platform admin is debugging a write path; every
 *     mutation is logged in `super_admin_audit` either way.
 *   - The cookie expires after 1 hour, requiring a fresh impersonation
 *     start.
 *
 * Cookie shape:
 *   bn_impersonate = base64(JSON.stringify({
 *     adminUserId, adminEmail, targetUserId, expiresAt
 *   }))
 *
 * Reads happen via `getActiveImpersonation()` — never read the raw cookie.
 */
import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "bn_impersonate";
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

/** Whether mutations are allowed during impersonation. Off by default. */
export const IMPERSONATION_ALLOWS_WRITES = false;

export interface ImpersonationToken {
  adminUserId: string;
  adminEmail: string;
  targetUserId: string;
  targetBusinessId: string;
  targetDisplayName?: string | null;
  expiresAt: number;
}

function encode(t: ImpersonationToken): string {
  return Buffer.from(JSON.stringify(t), "utf8").toString("base64url");
}

function decode(raw: string): ImpersonationToken | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const obj = JSON.parse(decoded);
    if (
      typeof obj?.adminUserId !== "string" ||
      typeof obj?.targetUserId !== "string" ||
      typeof obj?.targetBusinessId !== "string" ||
      typeof obj?.expiresAt !== "number"
    ) {
      return null;
    }
    return obj as ImpersonationToken;
  } catch {
    return null;
  }
}

/**
 * Server-side read. Returns the active impersonation token (if any and
 * still within its TTL) or null.
 */
export async function getActiveImpersonation(): Promise<ImpersonationToken | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  const tok = decode(raw);
  if (!tok) return null;
  if (tok.expiresAt < Date.now()) return null;
  return tok;
}

/**
 * Build the cookie value to set on a successful impersonation start.
 * The actual cookie set happens in the API route via NextResponse so it
 * also picks up `path`, `httpOnly`, `secure`, and `sameSite` flags.
 */
export function buildImpersonationCookieValue(
  payload: Omit<ImpersonationToken, "expiresAt">,
): string {
  const token: ImpersonationToken = {
    ...payload,
    expiresAt: Date.now() + IMPERSONATION_TTL_MS,
  };
  return encode(token);
}
