import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign-up and the pre-registration business quiz are for logged-out users only.
 * Owners who are already signed in should use Settings → Subscription instead.
 */
export default async function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return <>{children}</>;
}
