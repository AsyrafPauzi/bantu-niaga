"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { FollowUpWhatsAppSheet } from "@/components/marketing/FollowUpWhatsAppSheet";
import type { FollowUpDeskRow } from "@/lib/marketing/follow-up-desk";
import type { FollowUpReason } from "@/lib/marketing/follow-up-messages";
import { cn } from "@/lib/utils/cn";

const PANEL_META: Record<
  "dormant" | "noPurchase" | "notMessaged",
  { title: string; empty: string; reason: FollowUpReason }
> = {
  dormant: {
    title: "Dormant",
    empty: "No dormant customers with a phone.",
    reason: "dormant",
  },
  noPurchase: {
    title: "No purchase",
    empty: "Everyone on file has bought — or needs a phone.",
    reason: "no_purchase",
  },
  notMessaged: {
    title: "Not messaged · 30d",
    empty: "All customers with phones were contacted recently.",
    reason: "check_in",
  },
};

export function MarketingFollowUpDesk({
  dormant,
  noPurchase,
  notMessaged,
  businessName,
  preferredLocale = "en",
}: {
  dormant: FollowUpDeskRow[];
  noPurchase: FollowUpDeskRow[];
  notMessaged: FollowUpDeskRow[];
  businessName?: string;
  preferredLocale?: "en" | "ms";
}) {
  const [sheet, setSheet] = useState<{
    row: FollowUpDeskRow;
    reason: FollowUpReason;
  } | null>(null);

  const panels = [
    { key: "dormant" as const, rows: dormant },
    { key: "noPurchase" as const, rows: noPurchase },
    { key: "notMessaged" as const, rows: notMessaged },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
          Follow up today
        </h2>
        <p className="text-xs text-ink-muted dark:text-cream-400">
          One-tap WhatsApp — nothing sends automatically.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {panels.map(({ key, rows }) => {
          const meta = PANEL_META[key];
          return (
            <div
              key={key}
              className="rounded-2xl border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark"
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                  {meta.title}
                </h3>
                <span className="text-[11px] tabular-nums text-ink-subtle dark:text-cream-500">
                  {rows.length}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-muted dark:text-cream-500">
                  {meta.empty}
                </p>
              ) : (
                <ul className="max-h-[17.5rem] divide-y divide-cream-100 overflow-y-auto overscroll-contain dark:divide-hairline-dark">
                  {rows.map((row) => (
                    <li
                      key={`${key}-${row.id}`}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                          {row.name}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted dark:text-cream-500">
                          {row.phone_e164}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSheet({ row, reason: meta.reason })
                        }
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-2 py-1.5 text-[11px] font-semibold text-white",
                        )}
                      >
                        <MessageCircle className="h-3 w-3" />
                        WA
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {sheet ? (
        <FollowUpWhatsAppSheet
          open
          onClose={() => setSheet(null)}
          reason={sheet.reason}
          customerId={sheet.row.id}
          customerName={sheet.row.name}
          phoneE164={sheet.row.phone_e164}
          businessName={businessName}
          preferredLocale={preferredLocale}
        />
      ) : null}
    </section>
  );
}
