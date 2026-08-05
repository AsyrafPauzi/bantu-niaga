export type NadiaReplyMode = "text_only" | "voice_only" | "text_and_voice";

export interface PlatformAgentDefinition {
  slug: "nadia";
  defaultName: "Nadia";
  roleTitle: string;
  pillar: "platform";
  description: string;
  icon: string;
  chatHref: string;
  defaultModel: string;
  defaultReplyMode: NadiaReplyMode;
}

export const PLATFORM_AI_AGENTS: readonly PlatformAgentDefinition[] = [
  {
    slug: "nadia",
    defaultName: "Nadia",
    roleTitle: "Platform Analyst",
    pillar: "platform",
    description:
      "Read-only revenue, billing, and tenant health Q&A for super administrators.",
    icon: "line-chart",
    chatHref: "/super-admin/revenue",
    defaultModel: "ilmu-v3.1",
    defaultReplyMode: "text_and_voice",
  },
] as const;

export const NADIA_REPLY_MODE_LABELS: Record<NadiaReplyMode, string> = {
  text_only: "Text only",
  voice_only: "Voice only",
  text_and_voice: "Text + voice",
};
