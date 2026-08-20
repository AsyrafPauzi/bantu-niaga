import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { parseAppLocale, type AppLocale } from "@/lib/i18n/locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Resolve tenant UI locale from the signed-in profile (defaults to en). */
export async function getSessionLocale(): Promise<AppLocale> {
  try {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("users")
      .select("preferred_locale")
      .eq("id", user.id)
      .maybeSingle();
    return parseAppLocale(data?.preferred_locale);
  } catch (e) {
    if (e instanceof UnauthorizedError) return "en";
    throw e;
  }
}
