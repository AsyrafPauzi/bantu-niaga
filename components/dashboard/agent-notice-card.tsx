import Link from "next/link";
import { Sparkles } from "lucide-react";

interface AgentNoticeCardProps {
  title: string;
  body: string;
  assistantHref?: string;
  assistantName?: string;
}

export function AgentNoticeCard({
  title,
  body,
  assistantHref = "/hr/assistant",
  assistantName = "Hana",
}: AgentNoticeCardProps) {
  return (
    <div className="rounded-2xl border border-[#D5E2FB] bg-[#EEF3FE] p-4 dark:border-brand-900/60 dark:bg-brand-900/20">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-muted dark:text-cream-400">
            {body}
          </pre>
          <Link
            href={assistantHref}
            className="mt-3 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            Ask {assistantName} →
          </Link>
        </div>
      </div>
    </div>
  );
}
