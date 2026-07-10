import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Shown when a Marketing Premium feature needs a Marketplace add-on. */
export function MarketingAddonTeaser({
  title,
  description,
  slug,
}: {
  title: string;
  description: string;
  slug?: string;
}) {
  const href = slug
    ? `/marketplace?highlight=${encodeURIComponent(slug)}`
    : "/marketplace";

  return (
    <section className="rounded-xl border border-dashed border-cream-300 bg-cream-50/80 p-4 dark:border-hairline-dark dark:bg-panel-dark/60">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {description}
          </p>
          <Link
            href={href}
            className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            View in Marketplace →
          </Link>
          <p className="mt-1 text-[11px] text-ink-subtle dark:text-cream-500">
            Coming soon · efficiency &amp; automation add-on
          </p>
        </div>
      </div>
    </section>
  );
}
