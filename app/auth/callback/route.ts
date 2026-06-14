import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /auth/callback — handles every Supabase email-link return:
 *   - recovery: ?code=xxx&next=/reset-password
 *   - signup confirm: ?code=xxx
 *   - magic link: ?code=xxx&next=/home
 *
 * We swap the `code` for a session cookie and forward to `next`. If
 * Supabase fails (link expired, already used, env mis-config) we send
 * the user to /sign-in with a flash flag so the sign-in page can show
 * a friendly message.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";
  const error = url.searchParams.get("error_description");

  if (error) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", error);
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirect);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const redirect = new URL("/sign-in", url.origin);
    redirect.searchParams.set("auth_error", exchangeError.message);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
