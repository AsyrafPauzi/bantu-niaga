import { HR_ASSISTANT_ADDON_SLUG } from "@/lib/marketplace/agent-types";

/** Marketplace add-on slugs for module AI agents (Boardroom participants). */
export const AI_AGENT_ADDON_SLUGS = [
  HR_ASSISTANT_ADDON_SLUG,
  "finance-assistant",
  "marketing-assistant",
  "operations-assistant",
  "sales-assistant",
  "admin-assistant",
] as const;

export type BoardroomAgentId =
  | "finance"
  | "operations"
  | "marketing"
  | "sales"
  | "hr";

export interface BoardroomAgentMeta {
  id: BoardroomAgentId;
  addonSlug: string;
  label: string;
  role: string;
  tone: "brand" | "accent";
}

export const BOARDROOM_AGENTS: BoardroomAgentMeta[] = [
  {
    id: "finance",
    addonSlug: "finance-assistant",
    label: "Fayza",
    role: "Finance AI",
    tone: "brand",
  },
  {
    id: "operations",
    addonSlug: "operations-assistant",
    label: "Aiman",
    role: "Operations AI",
    tone: "accent",
  },
  {
    id: "marketing",
    addonSlug: "marketing-assistant",
    label: "Maya",
    role: "Marketing AI",
    tone: "accent",
  },
  {
    id: "sales",
    addonSlug: "sales-assistant",
    label: "Sufi",
    role: "Sales AI",
    tone: "brand",
  },
  {
    id: "hr",
    addonSlug: HR_ASSISTANT_ADDON_SLUG,
    label: "Hana",
    role: "HR AI",
    tone: "brand",
  },
];

export const BOARDROOM_MIN_AGENTS = 2;

export interface BoardroomAgentState extends BoardroomAgentMeta {
  live: boolean;
}

export interface BoardroomStatus {
  agents: BoardroomAgentState[];
  activeCount: number;
  unlocked: boolean;
}
