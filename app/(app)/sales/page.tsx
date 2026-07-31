import { redirect } from "next/navigation";
import { SalesOverview } from "@/components/sales/SalesOverview";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageSalesCore, canUseLeads, canUsePos, canUseSalesAssistant } from "@/lib/sales/access";
import { loadSalesDashboard } from "@/lib/sales/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const data = await loadSalesDashboard(supabase, user.businessId);

  return (
    <SalesOverview
      data={data}
      showPos={canUsePos(user.role)}
      showLeads={canUseLeads(user.role)}
      showAssistant={canUseSalesAssistant(user.role)}
      showHistory={canManageSalesCore(user.role)}
    />
  );
}
