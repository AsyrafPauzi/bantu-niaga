import { requirePillar } from "@/lib/auth/require-pillar";
import { PillarAssistantFloat } from "@/components/ai/PillarAssistantFloat";
import {
  canAccessPillarAssistantFloat,
  type PillarAssistantFloatKey,
} from "@/lib/ai/pillar-assistant-float-config";

async function pillarLayout(
  pillar: PillarAssistantFloatKey,
  children: React.ReactNode,
) {
  const { user } = await requirePillar(pillar);
  return (
    <>
      {children}
      {canAccessPillarAssistantFloat(pillar, user.role) ? (
        <PillarAssistantFloat
          pillar={pillar}
          businessId={user.businessId}
          userId={user.id}
        />
      ) : null}
    </>
  );
}

export default async function AdminPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return pillarLayout("admin", children);
}
