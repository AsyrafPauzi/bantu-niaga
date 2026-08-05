import { AssistantRichMessage } from "@/components/ai/AssistantRichMessage";

interface NadiaAssistantMessageProps {
  content: string;
  className?: string;
}

/** Rich Markdown renderer for Nadia platform analyst replies. */
export function NadiaAssistantMessage({
  content,
  className,
}: NadiaAssistantMessageProps) {
  return (
    <AssistantRichMessage
      content={content}
      pillar="platform"
      className={className}
    />
  );
}
