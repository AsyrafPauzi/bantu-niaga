"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileJson, Loader2 } from "lucide-react";

import {
  EXPORT_CATEGORIES,
  categoriesForScope,
  type ExportCategoryId,
  type ExportScope,
} from "@/lib/privacy/export-catalog";

interface ExportResult {
  exportId: string;
  byteSize: number;
  expiresAt: string;
  downloadUrl: string;
}

interface DataExportCardProps {
  isOwner: boolean;
}

export function DataExportCard({ isOwner }: DataExportCardProps) {
  const router = useRouter();
  const [scope, setScope] = useState<ExportScope>("personal");
  const [selected, setSelected] = useState<Set<ExportCategoryId>>(
    () => new Set(categoriesForScope("personal")),
  );
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const visibleCategories = useMemo(
    () => EXPORT_CATEGORIES.filter((c) => c.scope === scope),
    [scope],
  );

  const allSelected =
    visibleCategories.length > 0 &&
    visibleCategories.every((c) => selected.has(c.id));

  function switchScope(next: ExportScope) {
    setScope(next);
    setSelected(new Set(categoriesForScope(next)));
    setResult(null);
    setError(null);
  }

  function toggleCategory(id: ExportCategoryId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleCategories.map((c) => c.id)));
    }
    setResult(null);
  }

  async function requestExport() {
    if (selected.size === 0) {
      setError("Select at least one category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          scope,
          categories: Array.from(selected),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: ExportResult;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message ?? "Could not generate export.");
        return;
      }
      setResult(json.data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    if (!result?.downloadUrl) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(result.downloadUrl, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(
          (json as { error?: { message?: string } })?.error?.message ??
            "Download failed.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bantuniaga-export-${scope}-${result.exportId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <FileJson className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Download my data
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              JSON export · select categories · expires in 7 days
            </p>
          </div>
        </div>
        {!result ? (
          <button
            type="button"
            onClick={requestExport}
            disabled={busy || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Generate export
          </button>
        ) : (
          <button
            type="button"
            onClick={downloadExport}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Download JSON
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <ScopeButton
            active={scope === "personal"}
            onClick={() => switchScope("personal")}
          >
            My personal data
          </ScopeButton>
          {isOwner ? (
            <ScopeButton
              active={scope === "business"}
              onClick={() => switchScope("business")}
            >
              Full business data
            </ScopeButton>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink dark:text-cream-100">
            {scope === "personal"
              ? "Choose what to include"
              : "All modules in this business"}
          </p>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>

        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
          {visibleCategories.map((category) => {
            const checked = selected.has(category.id);
            return (
              <li key={category.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-cream-50 dark:hover:bg-hairline-dark/30">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(category.id)}
                    className="mt-0.5 h-4 w-4 rounded border-cream-300 text-brand-500 focus:ring-brand-400"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink dark:text-cream-100">
                      {category.label}
                    </span>
                    <span className="block text-xs text-ink-muted dark:text-cream-400">
                      {category.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {scope === "business" ? (
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            Owner-only export. Up to 5,000 rows per table. API secrets are never
            included.
          </p>
        ) : (
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            Your PDPA right of access — data tied to your account in this
            business.
          </p>
        )}

        {result ? (
          <p className="text-xs text-status-success">
            Ready · {formatBytes(result.byteSize)} · expires{" "}
            {new Date(result.expiresAt).toLocaleString("en-MY")}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-status-danger">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "bg-accent-500 text-white"
          : "border border-cream-300 bg-white text-ink-muted hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
      }`}
    >
      {children}
    </button>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
