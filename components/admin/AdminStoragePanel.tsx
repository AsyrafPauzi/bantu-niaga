"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CloudUpload,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  Loader2,
  Megaphone,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AdminFileRowActions } from "@/components/admin/AdminFileRowActions";
import {
  AdminFileUploader,
  type AdminStorageEmployeeOption,
} from "@/components/admin/AdminFileUploader";
import { AdminCatalogEmpty, AdminCatalogThumb } from "@/components/admin/AdminCatalogUi";
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
  share_hash?: string | null;
  share_enabled_at?: string | null;
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
  categoryCounts: Record<string, number>;
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

type ViewMode = "grid" | "list";

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
  newest: "Newest",
  largest: "Largest",
  name: "Name",
};

function folderLabel(
  activeCategory: string | null,
  hrDocsOnly: boolean,
): string {
  if (hrDocsOnly) return "HR documents";
  if (!activeCategory) return "All files";
  if ((ADMIN_FILE_CATEGORIES as readonly string[]).includes(activeCategory)) {
    return STORAGE_CATEGORY_LABELS[activeCategory as AdminFileCategory];
  }
  return "All files";
}

function FileGridCard({
  row,
  usage,
  onEdit,
}: {
  row: AdminStorageFileRow;
  usage: AdminFileUsageLink[];
  onEdit: () => void;
}) {
  const cat = categoryKey(row.category);
  const style =
    cat === "uncategorized" ? UNCATEGORIZED_STYLE : CATEGORY_STYLE[cat];
  const showThumb =
    row.mime_type.startsWith("image/") || row.mime_type === "application/pdf";

  return (
    <li
      className="group relative flex flex-col overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700"
    >
      <div className="relative aspect-[4/3] bg-cream-50 dark:bg-hairline-dark/30">
        {showThumb ? (
          <AdminStorageThumbnail
            fileId={row.id}
            mimeType={row.mime_type}
            fileName={row.file_name}
            className="absolute inset-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <AdminCatalogThumb
              icon={fileTypeIcon(row.mime_type)}
              tone="sky"
              className="h-14 w-14"
            />
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/50 via-transparent to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
              style.chip,
            )}
          >
            {cat === "uncategorized"
              ? "Other"
              : STORAGE_CATEGORY_LABELS[cat]}
          </span>
          <AdminFileRowActions
            id={row.id}
            fileName={row.file_name}
            mimeType={row.mime_type}
            category={row.category}
            shareEnabled={Boolean(row.share_enabled_at)}
            showLabels={false}
            onEdit={onEdit}
          />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink dark:text-cream-100"
          title={row.file_name}
        >
          {row.file_name}
        </p>
        <p className="text-[11px] text-ink-muted dark:text-cream-400">
          {formatStorageBytes(row.file_size_bytes)} · {fmtRelUpload(row.created_at)}
        </p>
        {usage.length > 0 ? (
          <p className="mt-1 text-[10px] font-medium text-brand-700 dark:text-brand-200">
            Linked to {usage.length} record{usage.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function FileListRow({
  row,
  usage,
  onEdit,
}: {
  row: AdminStorageFileRow;
  usage: AdminFileUsageLink[];
  onEdit: () => void;
}) {
  const cat = categoryKey(row.category);
  const style =
    cat === "uncategorized" ? UNCATEGORIZED_STYLE : CATEGORY_STYLE[cat];
  const CatIcon = style.icon;
  const TypeIcon = fileTypeIcon(row.mime_type);
  const showThumb =
    row.mime_type.startsWith("image/") || row.mime_type === "application/pdf";

  return (
    <tr className="group border-b border-cream-100 last:border-0 dark:border-hairline-dark/60">
      <td className="py-2.5 pl-3 pr-2">
        {showThumb ? (
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark">
            <AdminStorageThumbnail
              fileId={row.id}
              mimeType={row.mime_type}
              fileName={row.file_name}
              className="h-full w-full"
            />
          </div>
        ) : (
          <AdminCatalogThumb icon={TypeIcon} tone="sky" className="h-9 w-9 rounded-lg" />
        )}
      </td>
      <td className="min-w-0 py-2.5 pr-3">
        <p
          className="truncate text-sm font-semibold text-ink dark:text-cream-100"
          title={row.file_name}
        >
          {row.file_name}
        </p>
        {row.description ? (
          <p className="truncate text-[11px] text-ink-muted dark:text-cream-400">
            {row.description}
          </p>
        ) : null}
      </td>
      <td className="hidden py-2.5 pr-3 sm:table-cell">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
            style.chip,
          )}
        >
          <CatIcon className="h-3 w-3" />
          {cat === "uncategorized"
            ? "Other"
            : STORAGE_CATEGORY_LABELS[cat]}
        </span>
      </td>
      <td className="hidden py-2.5 pr-3 text-xs text-ink-muted md:table-cell dark:text-cream-400">
        {formatStorageBytes(row.file_size_bytes)}
      </td>
      <td className="hidden py-2.5 pr-3 text-xs text-ink-muted lg:table-cell dark:text-cream-400">
        {fmtRelUpload(row.created_at)}
      </td>
      <td className="hidden py-2.5 pr-3 xl:table-cell">
        {usage.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {usage.slice(0, 2).map((link) => (
              <Link
                key={`${link.type}-${link.id}`}
                href={link.href}
                className="text-[10px] font-medium text-brand-700 hover:underline dark:text-brand-200"
              >
                {USAGE_LINK_TYPE_LABELS[link.type]}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-ink-subtle">—</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right">
        <AdminFileRowActions
          id={row.id}
          fileName={row.file_name}
          mimeType={row.mime_type}
          category={row.category}
          shareEnabled={Boolean(row.share_enabled_at)}
          showLabels={false}
          onEdit={onEdit}
        />
      </td>
    </tr>
  );
}

export function AdminStoragePanel({
  rows: initialRows,
  nextCursor: initialCursor,
  quota,
  usageByFileId: usageByFileIdProp,
  categoryCounts,
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
  const [editingFile, setEditingFile] = useState<AdminStorageFileRow | null>(null);
  const [usageByFileId, setUsageByFileId] = useState(usageByFileIdProp);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [uploadOpen, setUploadOpen] = useState(false);

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

  const folderItems: Array<{ key: string; label: string; href: string }> = hrDocsOnly
    ? [{ key: "hr_doc", label: STORAGE_CATEGORY_LABELS.hr_doc, href: buildHref({ category: "hr_doc" }) }]
    : [
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
    ? `${formatStorageBytes(quota.usedBytes)} used`
    : `${formatStorageBytes(quota.usedBytes)} / ${quota.quotaGb} GB`;

  const currentFolder = folderLabel(activeCategory, hrDocsOnly);

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-cream-200 p-3 dark:border-hairline-dark sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-ink dark:text-cream-100">
              <FolderOpen className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              {currentFolder}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              {rows.length} shown
              {query ? ` · search “${query}”` : ""}
              {!quota.isUnlimited ? ` · ${quotaLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadOpen((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                "border border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:border-brand-600 dark:bg-brand-700/30 dark:text-brand-100",
              )}
            >
              <CloudUpload className="h-3.5 w-3.5" />
              Upload
            </button>
            <Link
              href="/admin/compliance"
              className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:text-cream-400"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Licences
            </Link>
            <div className="flex rounded-lg border border-cream-300 dark:border-hairline-dark">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "p-2",
                  viewMode === "grid"
                    ? "bg-brand-500 text-white"
                    : "text-ink-muted hover:bg-cream-100 dark:text-cream-400",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={cn(
                  "p-2",
                  viewMode === "list"
                    ? "bg-brand-500 text-white"
                    : "text-ink-muted hover:bg-cream-100 dark:text-cream-400",
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <form
          method="get"
          action="/admin/storage"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 dark:border-hairline-dark dark:bg-hairline-dark/20">
            <Search className="h-4 w-4 shrink-0 text-ink-muted" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search files…"
              className="w-full bg-transparent text-sm text-ink focus:outline-none dark:text-cream-100"
            />
          </div>
          <select
            name="sort"
            defaultValue={activeSort}
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            {ADMIN_FILE_SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
          </select>
          {!hrDocsOnly && activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Apply
          </button>
        </form>

        <p className="text-[11px] text-ink-muted dark:text-cream-400">
          Max {maxMb} MB per file
        </p>
      </div>

      {/* Upload modal */}
      {uploadOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setUploadOpen(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-2xl dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
              <div className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                <p className="text-sm font-bold text-ink dark:text-cream-100">Upload files</p>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <AdminFileUploader
                hrDocsOnly={hrDocsOnly}
                defaultCategory={defaultUploadCategory}
                variant="default"
                multiple
                employees={employees}
                employeeDocumentTypesByEmployeeId={employeeDocumentTypesByEmployeeId}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[420px]">
        {/* Folder sidebar */}
        {!hrDocsOnly ? (
          <aside
            className="hidden w-52 shrink-0 border-r border-cream-200 bg-cream-50/40 p-3 dark:border-hairline-dark dark:bg-hairline-dark/10 md:block"
            aria-label="Folders"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-400">
              Folders
            </p>
            <ul className="space-y-0.5">
              {folderItems.map((item) => {
                const active =
                  (item.key === "" && !activeCategory) ||
                  item.key === activeCategory;
                const count = categoryCounts[item.key] ?? 0;
                const catStyle =
                  item.key && item.key in CATEGORY_STYLE
                    ? CATEGORY_STYLE[item.key as AdminFileCategory]
                    : null;
                const FolderIcon = active ? FolderOpen : Folder;
                return (
                  <li key={item.key || "all"}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition",
                        active
                          ? "bg-brand-500 text-white shadow-sm"
                          : "text-ink-muted hover:bg-white hover:text-ink dark:text-cream-400 dark:hover:bg-panel-dark dark:hover:text-cream-100",
                      )}
                    >
                      <FolderIcon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-white" : catStyle ? "" : "",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span
                        className={cn(
                          "tabular-nums text-[10px]",
                          active ? "text-white/80" : "text-ink-subtle",
                        )}
                      >
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 p-3 sm:p-4">
          {/* Mobile folder chips */}
          {!hrDocsOnly ? (
            <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {folderItems.map((item) => {
                const active =
                  (item.key === "" && !activeCategory) ||
                  item.key === activeCategory;
                return (
                  <Link
                    key={item.key || "all"}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      active
                        ? "bg-brand-500 text-white"
                        : "border border-cream-300 bg-white text-ink-muted dark:border-hairline-dark dark:bg-panel-dark",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {errorMessage ? (
            <p className="mb-3 text-sm text-status-danger">{errorMessage}</p>
          ) : null}

          {rows.length === 0 ? (
            <AdminCatalogEmpty
              icon={<FolderOpen />}
              title={
                query || activeCategory
                  ? "No files in this folder"
                  : "This folder is empty"
              }
              hint={
                query || activeCategory
                  ? "Try another search or open All files."
                  : "Click Upload to add receipts, contracts, or scans."
              }
              className="border border-dashed border-cream-300 bg-cream-50/50 py-12 dark:border-hairline-dark dark:bg-hairline-dark/10"
            />
          ) : viewMode === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((row) => (
                <FileGridCard
                  key={row.id}
                  row={row}
                  usage={usageByFileId[row.id] ?? []}
                  onEdit={() => setEditingFile(row)}
                />
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-cream-200 dark:border-hairline-dark">
              <table className="min-w-full text-left">
                <thead className="bg-cream-50 text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                  <tr>
                    <th className="py-2 pl-3 pr-2 w-12" />
                    <th className="py-2 pr-3">Name</th>
                    <th className="hidden py-2 pr-3 sm:table-cell">Folder</th>
                    <th className="hidden py-2 pr-3 md:table-cell">Size</th>
                    <th className="hidden py-2 pr-3 lg:table-cell">Uploaded</th>
                    <th className="hidden py-2 pr-3 xl:table-cell">Linked</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <FileListRow
                      key={row.id}
                      row={row}
                      usage={usageByFileId[row.id] ?? []}
                      onEdit={() => setEditingFile(row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && nextCursor ? (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60 dark:border-brand-700 dark:bg-brand-700/30 dark:text-brand-100"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
              {loadMoreError ? (
                <p className="mt-2 text-xs text-status-danger">{loadMoreError}</p>
              ) : null}
            </div>
          ) : null}
        </main>
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
