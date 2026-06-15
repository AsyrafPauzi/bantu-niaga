import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { AdminFileUploader } from "@/components/admin/AdminFileUploader";
import { AdminFileRowActions } from "@/components/admin/AdminFileRowActions";
import {
  ADMIN_FILE_CATEGORIES,
  type AdminFileCategory,
} from "@/lib/admin/schemas";

export const metadata = { title: "Storage" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AdminFileListRow {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  category: string | null;
  description: string | null;
  created_at: string;
  uploaded_by: string;
}

function flattenParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function categoryLabel(category: string | null): string {
  if (!category) return "—";
  return category.replace(/_/g, " ");
}

function isAdminFileCategory(value: string): value is AdminFileCategory {
  return (ADMIN_FILE_CATEGORIES as readonly string[]).includes(value);
}

export default async function StoragePage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "admin", "storage")) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin"
          title="Digital storage"
          description="Securely store business documents (receipts, contracts, IC scans). 100 MB max per file."
        />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              You don&apos;t have access to Admin storage.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const hrDocsOnly =
    getSurfaceScope(user.role, "admin", "storage") === "rw_hr_docs_only";

  const params = flattenParams(await searchParams);
  const q = params.q?.trim() ?? "";
  const rawCategory = params.category?.trim() ?? "";
  // HR Officer scoping — clamp category to hr_doc no matter what was on the URL.
  const effectiveCategory: string | null = hrDocsOnly
    ? "hr_doc"
    : rawCategory && isAdminFileCategory(rawCategory)
      ? rawCategory
      : null;

  const supabase = await createSupabaseServerClient();

  let listQuery = supabase
    .from("admin_files")
    .select(
      "id, file_name, mime_type, file_size_bytes, category, description, " +
        "created_at, uploaded_by",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  if (effectiveCategory) {
    listQuery = listQuery.eq("category", effectiveCategory);
  }
  if (q) {
    const safe = q.replace(/[\\%_]/g, "");
    listQuery = listQuery.ilike("file_name", `%${safe}%`);
  }

  const { data, error } = await listQuery;
  const rows = (data ?? []) as unknown as AdminFileListRow[];

  // Hydrate uploader display names.
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by)));
  const nameLookup = new Map<string, string | null>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("users")
      .select("id, display_name, email")
      .in("id", uploaderIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      email: string | null;
    }>) {
      nameLookup.set(p.id, p.display_name || p.email);
    }
  }

  const visibleCategoryPills: Array<{ key: string; label: string; href: string }> = [
    { key: "", label: "All", href: "/admin/storage" },
    ...ADMIN_FILE_CATEGORIES.map((c) => ({
      key: c,
      label: c.replace(/_/g, " "),
      href: `/admin/storage?category=${encodeURIComponent(c)}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Digital storage"
        description="Securely store business documents (receipts, contracts, IC scans). 100 MB max per file."
      />

      <SectionCard
        title="Upload a file"
        subtitle="Maximum 100 MB per file. Files are private to your business."
      >
        <AdminFileUploader hrDocsOnly={hrDocsOnly} />
      </SectionCard>

      <Card>
        <form
          method="get"
          action="/admin/storage"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <Search className="h-4 w-4 text-ink-muted" strokeWidth={2} />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by file name…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100 dark:placeholder:text-cream-400"
            />
            {!hrDocsOnly && rawCategory ? (
              <input type="hidden" name="category" value={rawCategory} />
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Search
            </button>
            <Link
              href="/admin/storage"
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
            >
              Reset
            </Link>
          </div>
        </form>

        {!hrDocsOnly ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 px-4 py-3 dark:border-hairline-dark">
            {visibleCategoryPills.map((pill) => {
              const active =
                (pill.key === "" && !effectiveCategory) ||
                (pill.key !== "" && pill.key === effectiveCategory);
              const href = q
                ? pill.key
                  ? `${pill.href}&q=${encodeURIComponent(q)}`
                  : `${pill.href}?q=${encodeURIComponent(q)}`
                : pill.href;
              return (
                <Link
                  key={pill.key || "all"}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
                  )}
                >
                  {pill.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </Card>

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load files: {error.message}
          </CardBody>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardBody className="space-y-3 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <FolderOpen className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="text-sm font-medium text-ink dark:text-cream-100">
              No files yet
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Upload your first file above. Maximum 100 MB per file.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden lg:block">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                <tr>
                  <th className="px-5 py-3 text-left">File</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-right">Size</th>
                  <th className="px-3 py-3 text-left">Uploaded by</th>
                  <th className="px-3 py-3 text-right">When</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40"
                  >
                    <td className="px-5 py-3">
                      <p className="truncate font-semibold text-ink dark:text-cream-100">
                        {row.file_name}
                      </p>
                      {row.description ? (
                        <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
                          {row.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-ink-muted dark:text-cream-400">
                      {categoryLabel(row.category)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink dark:text-cream-100">
                      {formatBytes(row.file_size_bytes)}
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                      {nameLookup.get(row.uploaded_by) ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                      {fmtRel(row.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <AdminFileRowActions
                        id={row.id}
                        fileName={row.file_name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
            {rows.map((row) => (
              <div key={row.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                      {row.file_name}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                      {formatBytes(row.file_size_bytes)} · {fmtRel(row.created_at)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Uploaded by {nameLookup.get(row.uploaded_by) ?? "—"}
                  {row.category ? ` · ${categoryLabel(row.category)}` : ""}
                </p>
                {row.description ? (
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {row.description}
                  </p>
                ) : null}
                <AdminFileRowActions
                  id={row.id}
                  fileName={row.file_name}
                  showLabels={false}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
