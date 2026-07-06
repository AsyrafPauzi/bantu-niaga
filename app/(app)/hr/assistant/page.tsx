import { redirect } from "next/navigation";
import { HrAssistantChat } from "@/components/hr/HrAssistantChat";
import { HrAssistantShell } from "@/components/hr/layout/hr-assistant-shell";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  getCreditBalance,
  hasHrAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";

export const metadata = { title: "HR AI Assistant" };
export const dynamic = "force-dynamic";

export default async function HrAssistantPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    redirect("/hr");
  }

  const [addonActive, settings, balance] = await Promise.all([
    hasHrAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId),
    getCreditBalance(user.businessId),
  ]);

  return (
    <HrAssistantShell
      header={
        <HrPageHeader
          title={`${settings.displayName} · HR Assistant`}
          subtitle="Ask in plain language — leave, staff, and holidays from your HR records"
          helpHref="/more"
          className="px-4 lg:px-8"
        />
      }
    >
      <HrMobileSubnav className="shrink-0 border-b border-[#E5E0D8] px-4 dark:border-hairline-dark lg:px-8" />
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 lg:px-8 lg:py-4">
        <HrAssistantChat
          initialStatus={{
            addon_active: addonActive,
            assistant_enabled: settings.assistantEnabled,
            display_name: settings.displayName,
            credit_balance: balance,
          }}
        />
      </div>
    </HrAssistantShell>
  );
}
