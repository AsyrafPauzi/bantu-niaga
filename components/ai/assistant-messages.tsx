import {
  AssistantRichMessage,
  type AssistantMessagePillar,
} from "@/components/ai/AssistantRichMessage";

interface PillarAssistantMessageProps {
  content: string;
  className?: string;
}

function createAssistantMessage(pillar: AssistantMessagePillar) {
  return function PillarMessage({ content, className }: PillarAssistantMessageProps) {
    return (
      <AssistantRichMessage
        content={content}
        pillar={pillar}
        className={className}
      />
    );
  };
}

export const FayzaAssistantMessage = createAssistantMessage("finance");
export const MayaAssistantMessage = createAssistantMessage("marketing");
export const AdminAssistantMessage = createAssistantMessage("admin");
export const AimanAssistantMessage = createAssistantMessage("operations");
