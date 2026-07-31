import Link from "next/link";
import { MessageCircle, Send, Sparkles } from "lucide-react";

interface CustomerMayaWinBackCardProps {
  customerName: string;
  autoTags: string[];
  insight: string;
  className?: string;
}

export function CustomerMayaWinBackCard({
  customerName,
  autoTags,
  insight,
  className,
}: CustomerMayaWinBackCardProps) {
  const firstName = customerName.split(/\s+/)[0] ?? customerName;
  const isDormant = autoTags.includes("dormant");
  const isAtRisk = autoTags.includes("at-risk");
  const winBack = isDormant || isAtRisk;

  const mayaSeed = winBack
    ? `Help me plan a win-back for ${firstName} (${isAtRisk ? "at-risk" : "dormant"}). Suggest a short WhatsApp message and whether to add a coupon.`
    : `What should I do next for ${firstName} based on their CRM profile?`;

  return (
    <div
      className={
        className ??
        "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20"
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Maya · {winBack ? "Win-back idea" : "Insight"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink dark:text-cream-100">
            {insight}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/marketing/assistant?seed=${encodeURIComponent(mayaSeed)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              Ask Maya
            </Link>
            {winBack ? (
              <Link
                href="/marketing/broadcasts/new"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-panel-dark dark:text-violet-200"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                Draft broadcast
              </Link>
            ) : null}
            {winBack ? (
              <Link
                href="/marketing/coupons/new"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
                Create coupon
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
