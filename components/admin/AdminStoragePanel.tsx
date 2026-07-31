"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CloudUpload,
  FolderOpen,
  HardDrive,
  Link2,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { AdminFileRowActions } from "@/components/admin/AdminFileRowActions";
import { AdminFileUploader, type AdminStorageEmployeeOption } from "@/components/admin/AdminFileUploader";
import {
  AdminCatalogEmpty,
  AdminCatalogList,
  AdminCatalogThumb,
} from "@/components/admin/AdminCatalogUi";
import { AdminStorageEditModal } from "@/components/admin/AdminStorageEditModal";
import { AdminStorageThumbnail } from "@/components/admin/AdminStorageThumbnail";
import {
  ADMIN_FILE_CATEGORIES,
  ADMIN_FILE_MAX_BYTES,
  ADMIN_FILE_SORT_OPTIONS,
  type AdminFileCategory,
  type AdminFileListResponse,
  type AdminFileSort,
} from "@/lib/admin/schemas";
import type { AdminFileUsageLink } from "@/lib/admin/storage-usage";
import { USAGE_LINK_TYPE_LABELS } from "@/lib/admin/storage-usage";
import {
  CATEGORY_STYLE,
  STORAGE_CATEGORY_LABELS,
  fileTypeIcon,
  formatStorageBytes,
  fmtRelUpload,
} from "@/lib/admin/storage-shared";
import { cn } from "@/lib/utils/cn";

export interface AdminStorageFileRow {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  tags?: string[];
  created_at: string;
  uploaded_by: string;
  uploader_name?: string | null;
}

export interface AdminStorageStats {
  totalFiles: number;
  totalBytes: number;
  categoryCount: number;
  uploadedThisWeek: number;
}

export interface AdminStorageQuota {
  usedBytes: number;
  quotaGb: number | null;
  usagePct: number | null;
  isUnlimited: boolean;
}

interface AdminStoragePanelProps {
  rows: AdminStorageFileRow[];
  nextCursor: string | null;
  quota: AdminStorageQuota;
  usageByFileId: Record<string, AdminFileUsageLink[]>;
  hrDocsOnly: boolean;
  query: string;
  activeCategory: string | null;
  activeSort: AdminFileSort;
  errorMessage?: string | null;
  defaultUploadCategory?: AdminFileCategory | "";
  employees?: AdminStorageEmployeeOption[];
  employeeDocumentTypesByEmployeeId?: Record<string, string[]>;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { message?: string };
}

function categoryKey(
  raw: string | null,
): AdminFileCategory | "uncategorized" {
  if (raw && (ADMIN_FILE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as AdminFileCategory;
  }
  return "uncategorized";
}

const UNCATEGORIZED_STYLE = CATEGORY_STYLE.other;

const SORT_LABELS: Record<AdminFileSort, string> = {
  newest: "Newest first",
  largest: "Largest first",
  name: "Name A–Z",
};

export function AdminStoragePanel({
  rows: initialRows,
  nextCursor: initialCursor,
  quota,
  usageByFileId: usageByFileIdProp,
  hrDocsOnly,
  query,
  activeCategory,
  activeSort,
  errorMessage,
  defaultUploadCategory = "",
  employees = [],
  employeeDocumentTypesByEmployeeId = {},
}: AdminStoragePanelProps) {
  const maxMb = Math.round(ADMIN_FILE_MAX_BYTES / (1024 * 1024));
  const [rows, setRows] = useState(initialRows);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<AdminStorageFileRow | null>(
    null,
  );
  const [usageByFileId, setUsageByFileId] = useState(usageByFileIdProp);

  useEffect(() => {
    setRows(initialRows);
    setNextCursor(initialCursor);
    setUsageByFileId(usageByFileIdProp);
  }, [initialRows, initialCursor, usageByFileIdProp]);

  const buildHref = (overrides: {
    category?: string;
    sort?: AdminFileSort;
  } = {}) => {
    const params = new URLSearchParams();
    const category =
      overrides.category !== undefined ? overrides.category : activeCategory ?? "";
    const sort = overrides.sort ?? activeSort;
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    if (sort && sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/admin/storage?${qs}` : "/admin/storage";
  };

  const categoryPills: Array<{ key: string; label: string; href: string }> = [
    { key: "", label: "All files", href: buildHref({ category: "" }) },
    ...ADMIN_FILE_CATEGORIES.map((c) => ({
      key: c,
      label: STORAGE_CATEGORY_LABELS[c],
      href: buildHref({ category: c }),
    })),
  ];

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const params = new URLSearchParams();
      params.set("cursor", nextCursor);
      params.set("limit", "50");
      params.set("sort", activeSort);
      if (activeCategory) params.set("category", activeCategory);
      if (query) params.set("q", query);

      const res = await fetch(`/api/admin/storage?${params.toString()}`);
      const body = (await res.json()) as ApiEnvelope<AdminFileListResponse>;
      if (!res.ok || !body.data) {
        setLoadMoreError(body.error?.message ?? "Could not load more files.");
        return;
      }
      const incoming = body.data.data.map((r) => ({
        id: r.id,
        file_name: r.file_name,
        mime_type: r.mime_type,
        file_size_bytes: r.file_size_bytes,
        category: r.category,
        description: r.description,
        tags: r.tags ?? [],
        created_at: r.created_at,
        uploaded_by: r.uploaded_by,
        uploader_name: r.uploaded_by_name,
      }));
      setRows((prev) => [...prev, ...incoming]);
      setNextCursor(body.data.next_cursor);
      if (body.data.usage_by_file_id) {
        setUsageByFileId((prev) => ({
          ...prev,
          ...body.data!.usage_by_file_id!,
        }));
      }
    } catch (e) {
      setLoadMoreError(
        e instanceof Error ? e.message : "Could not load more files.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, activeSort, activeCategory, query]);

  const handleSaved = (updated: AdminStorageFileRow) => {
    setRows((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    );
  };

  const quotaLabel = quota.isUnlimited
    ? `${formatStorageBytes(quota.usedBytes)} used · unlimited plan`
    : `${formatStorageBytes(quota.usedBytes)} of ${quota.quotaGb} GB`;

  return (
    <div className="space-y-5">
      {!quota.isUnlimited && quota.quotaGb !== null ? (
        <section
          aria-label="Storage quota"
          className="rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-white p-4 shadow-card dark:border-violet-800 dark:from-violet-950/30 dark:to-panel-dark"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-900 dark:text-violet-100">
              <HardDrive className="h-4 w-4" />
              Storage quota
            </p>
            <p className="text-xs font-medium text-ink-muted dark:text-cream-300">
              {quotaLabel}
              {quota.usagePct !== null ? ` · ${quota.usagePct}%` : ""}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                (quota.usagePct ?? 0) >= 90
                  ? "bg-status-danger"
                  : (quota.usagePct ?? 0) >= 75
                    ? "bg-amber-500"
                    : "bg-violet-500",
              )}
              style={{ width: `${quota.usagePct ?? 0}%` }}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <p className="text-sm font-medium text-ink dark:text-cream-100">
          Social posts & campaign creatives live in Marketing
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Admin Storage is for back-office documents (receipts, contracts, licences).
          Instagram assets and content calendar files stay in the Marketing module.
        </p>
        <Link
          href="/marketing/content"
          className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
        >
          Open Marketing Content →
        </Link>
      </section>

      <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-violet-50/40 p-5 shadow-card dark:border-brand-800 dark:from-brand-950/40 dark:via-panel-dark dark:to-violet-950/20">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
              <CloudUpload className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              Drop files to upload
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Drag & drop one or many — tagged and searchable instantly.
            </p>
          </div>
          <Link
            href="/admin/compliance"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm hover:bg-white dark:border-brand-700 dark:bg-panel-dark/80 dark:text-brand-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Licence uploads
          </Link>
        </div>
        <AdminFileUploader
          hrDocsOnly={hrDocsOnly}
          defaultCategory={defaultUploadCategory}
          variant="hero"
          multiple
          employees={employees}
          employeeDocumentTypesByEmployeeId={employeeDocumentTypesByEmployeeId}
        />
      </div>

      <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <form
          method="get"
          action="/admin/storage"
          className="flex flex-col gap-3 border-b border-cream-200 p-4 sm:flex-row sm:items-center dark:border-hairline-dark"
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-hairline-dark/20">
            <Search className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search file names…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted dark:text-cream-400">
            Sort
            <select
              name="sort"
              defaultValue={activeSort}
              className="rounded-lg border border-cream-300 bg-white px-2 py-2 text-sm font-normal text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              {ADMIN_FILE_SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {!hrDocsOnly && activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Search
            </button>
            <Link
              href="/admin/storage"
              className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {!hrDocsOnly ? (
          <div className="flex flex-wrap gap-2 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
            {categoryPills.map((pill) => {
              const active =
                (pill.key === "" && !activeCategory) ||
                pill.key === activeCategory;
              const catStyle =
                pill.key && pill.key in CATEGORY_STYLE
                  ? CATEGORY_STYLE[pill.key as AdminFileCategory]
                  : null;
              return (
                <Link
                  key={pill.key || "all"}
                  href={pill.href}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                      : catStyle
                        ? catStyle.chip
                        : "border-cream-300 bg-white text-ink-muted dark:border-hairline-dark dark:bg-panel-dark",
                  )}
                >
                  {pill.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {errorMessage ? (
          <p className="px-4 py-3 text-sm text-status-danger">{errorMessage}</p>
        ) : null}

        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <AdminCatalogEmpty
              icon={FolderOpen}
              title={
                query || activeCategory
                  ? "No files match your filters"
                  : "Your vault is empty"
              }
              hint={
                query || activeCategory
                  ? "Try another search or category."
                  : "Upload a receipt, contract, or SSM PDF above."
              }
              className="border-none bg-transparent py-8 dark:bg-transparent"
            />
          </div>
        ) : (
          <AdminCatalogList title="File vault" total={rows.length}>
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {rows.map((row) => {
                const cat = categoryKey(row.category);
                const style =
                  cat === "uncategorized"
                    ? UNCATEGORIZED_STYLE
                    : CATEGORY_STYLE[cat];
                const CatIcon = style.icon;
                const TypeIcon = fileTypeIcon(row.mime_type);
                const usage = usageByFileId[row.id] ?? [];
                const showThumb =
                  row.mime_type.startsWith("image/") ||
                  row.mime_type === "application/pdf";

                return (
                  <li
                    key={row.id}
                    className="group px-3 py-3 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60 sm:px-4"
                  >
                    <div className="flex items-start gap-3">
                      {showThumb ? (
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-cream-200 dark:border-hairline-dark">
                          <AdminStorageThumbnail
                            fileId={row.id}
                            mimeType={row.mime_type}
                            fileName={row.file_name}
                            className="absolute inset-0"
                          />
                        </div>
                      ) : (
                        <AdminCatalogThumb icon={TypeIcon} tone="sky" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className="truncate text-sm font-semibold text-ink dark:text-cream-100"
                            title={row.file_name}
                          >
                            {row.file_name}
                          </p>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              cat !== "uncategorized"
                                ? style.chip
                                : "bg-cream-100 text-ink-muted dark:bg-hairline-dark",
                            )}
                          >
                            <CatIcon className="h-3 w-3" />
                            {cat === "uncategorized"
                              ? "Uncategorised"
                              : STORAGE_CATEGORY_LABELS[cat]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                          {formatStorageBytes(row.file_size_bytes)} ·{" "}
                          {fmtRelUpload(row.created_at)}
                          {row.uploader_name ? ` · ${row.uploader_name}` : ""}
                        </p>
                        {row.description ? (
                          <p className="mt-1 line-clamp-1 text-[11px] text-ink-muted dark:text-cream-400">
                            {row.description}
                          </p>
                        ) : null}
                        {usage.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {usage.map((link) => (
                              <Link
                                key={`${link.type}-${link.id}`}
                                href={link.href}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline dark:text-brand-200"
                              >
                                <Link2 className="h-3 w-3" />
                                {USAGE_LINK_TYPE_LABELS[link.type]}: {link.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <AdminFileRowActions
                          id={row.id}
                          fileName={row.file_name}
                          mimeType={row.mime_type}
                          showLabels={false}
                          onEdit={() => setEditingFile(row)}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminCatalogList>
        )}

        {rows.length > 0 && nextCursor ? (
              <div className="border-t border-cream-200 px-4 py-4 text-center dark:border-hairline-dark">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more files"
                  )}
                </button>
                {loadMoreError ? (
                  <p className="mt-2 text-xs text-status-danger">{loadMoreError}</p>
                ) : null}
              </div>
        ) : null}
      </div>

      {editingFile ? (
        <AdminStorageEditModal
          file={editingFile}
          hrDocsOnly={hrDocsOnly}
          onClose={() => setEditingFile(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
