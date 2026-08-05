"use client";

import { useState } from "react";
import { Loader2, Paperclip, Pencil, Trash2 } from "lucide-react";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { FinanceTxnExportButton } from "@/components/finance/FinanceTxnExportButton";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListPanelHeader,
} from "@/components/dashboard/module-list-panel";
import { cn } from "@/lib/utils/cn";
import { formatMyr, type FinanceTransactionRow } from "@/lib/finance/schemas";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export interface FinanceTxnCategoryMeta {
  label: string;
  emoji: string;
  chip: string;
}

interface FinanceTxnCompactListProps {
  title: string;
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
  transactions: FinanceTransactionRow[];
  kind: "income" | "expense";
  categoryMeta: (cat: string) => FinanceTxnCategoryMeta;
  busyId: string | null;
  isEditable: (row: FinanceTransactionRow) => boolean;
  onEdit: (row: FinanceTransactionRow) => void;
  onRemove: (id: string, amt: number) => void;
  onAttachReceipt: (id: string, fileId: string | null) => Promise<void>;
  /** YYYY-MM — enables month CSV export in the list header. */
  exportMonth?: string;
  /** Month entry count — disables export when zero. */
  exportEntryCount?: number;
  /** Renders inside ModuleListPanelFilters (category chips, search). */
  filters?: React.ReactNode;
}

export function FinanceTxnCompactList({
  title,
  emptyIcon,
  emptyTitle,
  emptyHint,
  transactions,
  kind,
  categoryMeta,
  busyId,
  isEditable,
  onEdit,
  onRemove,
  onAttachReceipt,
  exportMonth,
  exportEntryCount,
  filters,
}: FinanceTxnCompactListProps) {
  const [attachRowId, setAttachRowId] = useState<string | null>(null);
  const isIncome = kind === "income";
  const amountClass = isIncome
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-rose-700 dark:text-rose-300";

  return (
    <ModuleListPanel>
      {filters ? (
        <ModuleListPanelFilters>{filters}</ModuleListPanelFilters>
      ) : (
        <ModuleListPanelHeader variant="compact">
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              {title}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {exportMonth ? (
                <FinanceTxnExportButton
                  kind={kind}
                  month={exportMonth}
                  disabled={(exportEntryCount ?? transactions.length) === 0}
                />
              ) : null}
              {transactions.length > 0 ? (
                <span className="text-[11px] tabular-nums text-ink-muted dark:text-cream-400">
                  {transactions.length}
                </span>
              ) : null}
            </div>
          </div>
        </ModuleListPanelHeader>
      )}

      {transactions.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-2xl">{emptyIcon}</p>
          <p className="mt-1.5 text-sm font-medium text-ink dark:text-cream-100">
            {emptyTitle}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {emptyHint}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
          {transactions.map((row) => {
            const amt = Number(row.amount_myr);
            const meta = categoryMeta(row.category ?? "other");
            const editable = isEditable(row);
            const busy = busyId === row.id;
            const showAttach = attachRowId === row.id;

            return (
              <li
                key={row.id}
                className="group px-3 py-2 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm",
                      meta.chip,
                    )}
                    title={meta.label}
                  >
                    {meta.emoji}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium leading-tight text-ink dark:text-cream-100">
                        {row.description}
                      </p>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums leading-tight",
                          amountClass,
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {formatMyr(amt)}
                      </p>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                      <span>{fmtDate(row.txn_date)}</span>
                      {row.counterparty ? (
                        <span className="max-w-[10rem] truncate">
                          · {row.counterparty}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded px-1 py-px text-[10px] font-semibold",
                          meta.chip,
                        )}
                      >
                        {meta.label}
                      </span>
                      {!editable ? <span>· auto</span> : null}
                      {editable && row.admin_file_id && row.admin_file_name ? (
                        <span className="inline-flex max-w-[8rem] items-center gap-0.5 truncate text-brand-700 dark:text-brand-200">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{row.admin_file_name}</span>
                        </span>
                      ) : null}
                      {editable && !row.admin_file_id && !showAttach ? (
                        <button
                          type="button"
                          onClick={() => setAttachRowId(row.id)}
                          className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline dark:text-brand-200"
                        >
                          <Paperclip className="h-3 w-3" />
                          Receipt
                        </button>
                      ) : null}
                    </div>

                    {editable && showAttach ? (
                      <div className="mt-1.5 max-w-md">
                        <AdminStorageFileAttach
                          fileId={row.admin_file_id}
                          fileName={row.admin_file_name}
                          category="receipt"
                          compact
                          onAttach={async (fileId) => {
                            await onAttachReceipt(row.id, fileId);
                            setAttachRowId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setAttachRowId(null)}
                          className="mt-1 text-[10px] font-medium text-ink-muted hover:text-ink dark:text-cream-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {editable ? (
                    <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 hover:text-brand-700 dark:text-cream-400 dark:hover:bg-hairline-dark/50 dark:hover:text-brand-200"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onRemove(row.id, amt)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-status-danger/10 hover:text-status-danger dark:text-cream-400"
                        aria-label="Remove"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ModuleListPanel>
  );
}
