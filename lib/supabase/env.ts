/**
 * Centralised Supabase env-var reader.
 *
 * Returns `null` when either the project URL or the anon key is missing.
 * Callers decide what "not configured" means:
 *
 *   - middleware:        skip the auth refresh and continue (dev convenience)
 *   - server/client SDK: throw a clear, actionable error
 *
 * This keeps the dev server runnable on a fresh clone with no Supabase
 * project, while still failing loudly the moment real auth/data is needed.
 */
export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

let warned = false;

/**
 * One-shot dev warning. Safe to call on every request; only logs once
 * per process. No-op in production so we don't spam server logs.
 */
export function warnSupabaseNotConfiguredOnce(context: string) {
  if (warned) return;
  if (process.env.NODE_ENV === "production") return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ` +
      `not set — ${context} is running in unauthenticated mode. ` +
      `Set them in .env.local to enable auth.`,
  );
}
