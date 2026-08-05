import { requirePillar } from "@/lib/auth/require-pillar";
import { canManageMarketingCore } from "@/lib/marketing/access";
import { MayaFloatingAssistant } from "@/components/marketing/MayaFloatingAssistant";

export default async function MarketingPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("marketing");
  return (
    <>
      {children}
      {canManageMarketingCore(user.role) ? (
        <MayaFloatingAssistant
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
