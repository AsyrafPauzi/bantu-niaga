import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import { canAccessPillarAssistantFloat } from "@/lib/ai/pillar-assistant-float-config";

export default async function FinancePillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("finance");
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat("finance", user.role) ? (
        <PillarAssistantFloat
          pillar="finance"
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
