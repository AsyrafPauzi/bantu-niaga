import type { EmailLocale } from "@/lib/email/types";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";

type Admin = ReturnType<typeof createServiceRoleClient>;

export async function resolvePreferredLocale(
  admin: Admin,
  userId: string,
): Promise<EmailLocale> {
  const { data } = await admin
    .from("users")
    .select("preferred_locale")
    .eq("id", userId)
    .maybeSingle();

  const raw =
    data && typeof data === "object" && "preferred_locale" in data
      ? (data as { preferred_locale?: unknown }).preferred_locale
      : null;
  return raw === "ms" ? "ms" : "en";
}
