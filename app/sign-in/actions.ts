"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-action sign-out. Clears the Supabase session cookies via the
 * server client, then redirects to `/sign-in`.
 *
 * Used by the small sign-out button rendered in the desktop + mobile
 * shells (M1 auth wiring).
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
