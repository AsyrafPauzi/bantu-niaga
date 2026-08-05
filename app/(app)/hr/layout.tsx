import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import { canAccessPillarAssistantFloat } from "@/lib/ai/pillar-assistant-float-config";

export default async function HrPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("hr");
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat("hr", user.role) ? (
        <PillarAssistantFloat
          pillar="hr"
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
