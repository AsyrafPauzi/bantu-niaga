import { PillarAssistantFloatClient } from "@/components/ai/PillarAssistantFloatClient";
import { loadPillarAssistantFloatStatus } from "@/lib/ai/load-pillar-assistant-float";
import type { PillarAssistantFloatKey } from "@/lib/ai/pillar-assistant-float-config";

export async function PillarAssistantFloat({
  pillar,
  businessId,
  userId,
}: {
  pillar: PillarAssistantFloatKey;
  businessId: string;
  userId: string;
}) {
  const initialStatus = await loadPillarAssistantFloatStatus(
    pillar,
    businessId,
    userId,
  );

  return (
    <PillarAssistantFloatClient
      pillar={pillar}
      businessId={businessId}
      initialStatus={initialStatus}
    />
  );
}
