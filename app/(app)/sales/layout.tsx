import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import { canAccessPillarAssistantFloat } from "@/lib/ai/pillar-assistant-float-config";

export default async function SalesPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePillar("sales");
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat("sales", user.role) ? (
        <PillarAssistantFloat
          pillar="sales"
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}
