"use client";

import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";

interface FinanceTxnDocumentFieldProps {
  fileId: string | null;
  fileName: string | null;
  onAttach: (fileId: string | null) => Promise<void>;
  label?: string;
  hint?: string;
}

export function FinanceTxnDocumentField({
  fileId,
  fileName,
  onAttach,
  label = "Supporting document (optional)",
  hint = "Receipt, transfer slip, or agreement — upload or pick from Storage.",
}: FinanceTxnDocumentFieldProps) {
  return (
    <div className="rounded-xl border border-cream-200/80 bg-white/70 p-3 dark:border-hairline-dark dark:bg-panel-dark/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
        {hint}
      </p>
      <div className="mt-2.5">
        <AdminStorageFileAttach
          fileId={fileId}
          fileName={fileName}
          category="receipt"
          compact
          className="w-full"
          onAttach={onAttach}
        />
      </div>
    </div>
  );
}
