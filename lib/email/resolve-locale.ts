import type { EmailLocale } from "@/lib/email/types";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";

type Admin = ReturnType<typeof createServiceRoleClient>;

export function parseEmailLocaleHint(raw: unknown): EmailLocale | null {
  return raw === "ms" || raw === "en" ? raw : null;
}

export async function resolvePreferredLocale(
  admin: Admin,
  userId: string,
  metadataHint?: unknown,
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
  if (raw === "ms" || raw === "en") return raw;

  return parseEmailLocaleHint(metadataHint) ?? "en";
}
