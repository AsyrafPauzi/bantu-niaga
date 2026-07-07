import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function isEmailVerified(
  user: { email_confirmed_at?: string | null } | null | undefined,
): boolean {
  return Boolean(user?.email_confirmed_at);
}

export async function sendSignupVerificationEmail(opts: {
  email: string;
  password: string | null;
  redirectTo: string;
  admin: SupabaseClient;
}): Promise<{ sent: boolean; devLink: string | null }> {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("Supabase is not configured.");
  }

  const anon = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: resendError } = await anon.auth.resend({
    type: "signup",
    email: opts.email,
    options: { emailRedirectTo: opts.redirectTo },
  });

  if (!resendError) {
    return { sent: true, devLink: null };
  }

  if (opts.password) {
    const { data: linkData, error: linkError } =
      await opts.admin.auth.admin.generateLink({
        type: "signup",
        email: opts.email,
        password: opts.password,
        options: { redirectTo: opts.redirectTo },
      });

    if (!linkError && linkData?.properties?.action_link) {
      const devLink = linkData.properties.action_link;
      const devBypass =
        process.env.NODE_ENV === "development" &&
        !process.env.SUPABASE_SIGNUP_EMAIL_ENABLED;

      if (devBypass) {
        return { sent: false, devLink };
      }
    }
  }

  throw new Error(resendError.message ?? "Could not send verification email.");
}
