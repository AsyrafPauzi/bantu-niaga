import { Clock } from "lucide-react";

import { RETENTION_SCHEDULE } from "@/lib/privacy/catalog";

export function RetentionScheduleCard() {
  return (
    <section className="rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200"
        >
          <Clock className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Data retention schedule
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            How long we keep each category, and the legal basis for keeping
            it. Required by PDPA s.8 (Retention Principle).
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-50 text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:bg-panel-dark/40">
            <tr>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Retention</th>
              <th className="px-4 py-2">Legal basis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {RETENTION_SCHEDULE.map((row) => (
              <tr key={row.category} className="bg-white dark:bg-panel-dark">
                <td className="px-4 py-3 align-top text-ink dark:text-cream-100">
                  {row.category}
                </td>
                <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                  {row.retention}
                </td>
                <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                  {row.legalBasis}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
