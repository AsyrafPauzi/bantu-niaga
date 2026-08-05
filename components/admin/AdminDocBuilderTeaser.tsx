import Link from "next/link";
import { FilePenLine } from "lucide-react";

export function AdminDocBuilderTeaser() {
  return (
    <section className="rounded-xl border border-dashed border-cream-300 bg-gradient-to-r from-cream-50/90 to-brand-50/40 p-4 dark:border-hairline-dark dark:from-panel-dark/80 dark:to-brand-900/20">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-sm ring-1 ring-cream-200 dark:bg-panel-dark dark:text-brand-200 dark:ring-hairline-dark">
          <FilePenLine className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Custom document builder
            </p>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            Save your own branded letter layouts, clauses, and reusable
            templates — beyond the system starters below.
          </p>
          <Link
            href="/marketplace?highlight=admin-doc-builder"
            className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            View in Marketplace
          </Link>
        </div>
      </div>
    </section>
  );
}
