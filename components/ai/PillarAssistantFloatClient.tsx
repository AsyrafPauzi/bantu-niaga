"use client";

import type { ComponentType, Ref } from "react";
import { AdminAssistantChat } from "@/components/admin/AdminAssistantChat";
import { AdminAssistantGate } from "@/components/admin/AdminAssistantGate";
import { FayzaAssistantChat } from "@/components/finance/FayzaAssistantChat";
import { FayzaAssistantGate } from "@/components/finance/FayzaAssistantGate";
import { HrAssistantChat } from "@/components/hr/HrAssistantChat";
import { HrAssistantGate } from "@/components/hr/HrAssistantGate";
import { MayaAssistantChat } from "@/components/marketing/MayaAssistantChat";
import { MayaAssistantGate } from "@/components/marketing/MayaAssistantGate";
import { AimanAssistantChat } from "@/components/operations/AimanAssistantChat";
import { AimanAssistantGate } from "@/components/operations/AimanAssistantGate";
import { SufiAssistantChat } from "@/components/sales/SufiAssistantChat";
import { SufiAssistantGate } from "@/components/sales/SufiAssistantGate";
import { PillarAssistantPanel } from "@/components/ai/PillarAssistantPanel";
import type {
  PillarAssistantChatHandle,
  PillarAssistantStatus,
} from "@/lib/ai/pillar-assistant-types";
import {
  PILLAR_ASSISTANT_FLOAT_META,
  type PillarAssistantFloatKey,
} from "@/lib/ai/pillar-assistant-float-meta";
import { pillarClasses } from "@/lib/pillars/theme";

type ChatProps = {
  businessId: string;
  initialStatus: PillarAssistantStatus;
  initialSeed?: string;
  variant?: "page" | "panel";
  onStatusChange?: (status: PillarAssistantStatus) => void;
  ref?: Ref<PillarAssistantChatHandle>;
};

const REGISTRY: Record<
  PillarAssistantFloatKey,
  {
    Chat: ComponentType<ChatProps>;
    Gate: ComponentType;
  }
> = {
  admin: { Chat: AdminAssistantChat, Gate: AdminAssistantGate },
  finance: { Chat: FayzaAssistantChat, Gate: FayzaAssistantGate },
  operations: { Chat: AimanAssistantChat, Gate: AimanAssistantGate },
  marketing: { Chat: MayaAssistantChat, Gate: MayaAssistantGate },
  sales: { Chat: SufiAssistantChat, Gate: SufiAssistantGate },
  hr: { Chat: HrAssistantChat, Gate: HrAssistantGate },
};

export function PillarAssistantFloatClient({
  pillar,
  businessId,
  initialStatus,
}: {
  pillar: PillarAssistantFloatKey;
  businessId: string;
  initialStatus: PillarAssistantStatus;
}) {
  const config = PILLAR_ASSISTANT_FLOAT_META[pillar];
  const { Chat, Gate } = REGISTRY[pillar];
  const theme = pillarClasses[pillar];

  return (
    <PillarAssistantPanel
      config={config}
      businessId={businessId}
      initialStatus={initialStatus}
      fabClassName={theme.btnPrimary}
      gate={<Gate />}
    >
      {({ chatRef, seed, onStatusChange }) => (
        <Chat
          ref={chatRef}
          businessId={businessId}
          initialStatus={initialStatus}
          initialSeed={seed}
          variant="panel"
          onStatusChange={onStatusChange}
        />
      )}
    </PillarAssistantPanel>
  );
}
