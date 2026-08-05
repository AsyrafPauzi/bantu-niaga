import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import { canAccessPillarAssistantFloat } from "@/lib/ai/pillar-assistant-float-config";

export default async function OperationsPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("operations");
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat("operations", user.role) ? (
        <PillarAssistantFloat
          pillar="operations"
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
