import { redirect } from "next/navigation";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { canAcceptPublicSignup } from "@/lib/platform/standalone-bootstrap";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * Gate self-serve sign-up in standalone mode — only open during first-time
 * bootstrap (zero businesses). Otherwise owners sign in via seeded accounts.
 */
export default async function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isStandaloneDeployment()) {
    const admin = createServiceRoleClient();
    const allowed = await canAcceptPublicSignup(admin);
    if (!allowed) {
      redirect("/sign-in");
    }
  }

  return children;
}
