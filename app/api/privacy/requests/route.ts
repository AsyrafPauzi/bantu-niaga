import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { ok, unauthorized } from "@/lib/api/response";
import { loadUserDsrs } from "@/lib/privacy/load";

/**
 * GET /api/privacy/requests
 *
 * Returns the calling user's last 20 data-subject requests (export,
 * delete, consent_change, etc.). Used by the /settings/privacy page
 * to render the "Recent privacy requests" table.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return unauthorized("Authentication required.", { requestId });
    }
    throw e;
  }
  const requests = await loadUserDsrs(user.id);
  return ok({ requests }, { requestId });
}
