import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import { canAccessPillarAssistantFloat } from "@/lib/ai/pillar-assistant-float-config";

export default async function MarketingPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("marketing");
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat("marketing", user.role) ? (
        <PillarAssistantFloat
          pillar="marketing"
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
