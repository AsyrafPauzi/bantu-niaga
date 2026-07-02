import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client factory.
 *
 * The service-role key bypasses Row-Level Security. Reserved for two
 * narrow paths:
 *
 *   1. `lib/marketing/upsertFromPos.ts` — the only Marketing surface that
 *      runs without a Marketing-permissioned caller (cashier at POS).
 *   2. Staff leave-link submission, where an unauthenticated employee can
 *      create a leave request only through a hashed, one-time HR token.
 *   3. Admin / Edge-Function workers (e.g. the nightly tag refresh) that
 *      run outside an authenticated session.
 *
 * Every caller MUST tenant-scope every query with `.eq("business_id", …)`
 * — there is no longer an RLS safety net. The wrapper helpers in
 * `lib/marketing/*` encode that contract.
 *
 * The key is NEVER logged. The thrown error deliberately does not include
 * the value, only the env var names that are missing.
 *
 * @see docs/plans/marketing-decisions.md Q3
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `createServiceRoleClient: missing required env var(s): ${missing}. ` +
        `Set them in .env.local. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.`,
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
