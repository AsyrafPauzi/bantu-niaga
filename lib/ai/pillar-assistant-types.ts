export type PillarAssistantChatRole = "user" | "assistant";

export interface PillarAssistantChatTurn {
  role: PillarAssistantChatRole;
  content: string;
}

export interface PillarAssistantStatus {
  addon_active: boolean;
  assistant_enabled: boolean;
  display_name: string;
  credit_balance: number;
  credit_cost_chat?: number;
  reasoning_mode?: string;
  credits_paused?: boolean;
  business_id?: string;
  recent_turns?: PillarAssistantChatTurn[];
}

export interface PillarAssistantChatHandle {
  newChat: () => void;
}

export type PillarAssistantChatVariant = "page" | "panel";
