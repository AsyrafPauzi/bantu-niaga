import {
  AssistantRichMessage,
} from "@/components/ai/AssistantRichMessage";

interface SufiAssistantMessageProps {
  content: string;
  className?: string;
}

/** Safe subset of Markdown for Sufi assistant replies (lists, bold, internal links). */
export function SufiAssistantMessage({
  content,
  className,
}: SufiAssistantMessageProps) {
  return (
    <AssistantRichMessage
      content={content}
      pillar="sales"
      className={className}
    />
  );
}
