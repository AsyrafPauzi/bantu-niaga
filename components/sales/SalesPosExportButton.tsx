"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { SalesExportPeriod } from "@/lib/sales/pos-export";
import { cn } from "@/lib/utils/cn";

export async function downloadPosSalesExport(
  period: SalesExportPeriod,
): Promise<void> {
  const params = new URLSearchParams({ period });
  const res = await fetch(`/api/sales/pos/export?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    let message = "Export failed";
    try {
      const json = (await res.json()) as { message?: string };
      message = json.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bantuniaga-pos-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface SalesPosExportButtonProps {
  period: SalesExportPeriod;
  disabled?: boolean;
  className?: string;
}

export function SalesPosExportButton({
  period,
  disabled = false,
  className,
}: SalesPosExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setLoading(true);
    setError(null);
    try {
      await downloadPosSalesExport(period);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-end", className)}>
      <button
        type="button"
        onClick={() => void onExport()}
        disabled={disabled || loading}
        title="Export POS sales"
        className="inline-flex items-center gap-1 rounded-md border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:border-blue-200 hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:border-blue-700 dark:hover:text-blue-300"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        Export
      </button>
      {error ? (
        <p className="mt-1 max-w-[12rem] text-right text-[10px] text-status-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
