import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AdminStoragePanel,
  type AdminStorageFileRow,
  type AdminStorageStats,
} from "@/components/admin/AdminStoragePanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees, loadHrDocuments } from "@/lib/hr/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_FILE_CATEGORIES,
  ADMIN_FILE_SORT_OPTIONS,
  type AdminFileCategory,
  type AdminFileSort,
} from "@/lib/admin/schemas";
import {
  hydrateUploaderNames,
  listAdminFiles,
} from "@/lib/admin/storage-server";
import { loadStorageQuota } from "@/lib/admin/storage-quota";
import { loadFileUsageLinks } from "@/lib/admin/storage-usage";
import { tierBy } from "@/lib/settings/plans";

export const metadata = { title: "Storage" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

function isAdminFileCategory(value: string): value is AdminFileCategory {
  return (ADMIN_FILE_CATEGORIES as readonly string[]).includes(value);
}

function isAdminFileSort(value: string): value is AdminFileSort {
  return (ADMIN_FILE_SORT_OPTIONS as readonly string[]).includes(value);
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
          title="Your business file vault"
          description="Securely store receipts, contracts, and licence PDFs."
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
  const uploadAs = params.upload_as?.trim() ?? "";
  const rawSort = params.sort?.trim() ?? "newest";
  const activeSort: AdminFileSort = isAdminFileSort(rawSort) ? rawSort : "newest";

  const effectiveCategory: string | null = hrDocsOnly
    ? "hr_doc"
    : rawCategory && isAdminFileCategory(rawCategory)
      ? rawCategory
      : null;

  const defaultUploadCategory: AdminFileCategory | "" =
    !hrDocsOnly && uploadAs && isAdminFileCategory(uploadAs) ? uploadAs : "";

  const supabase = await createSupabaseServerClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("tier")
    .eq("id", user.businessId)
    .maybeSingle();

  const tierKey = (business as { tier?: string } | null)?.tier ?? "starter";
  const tier = tierBy(tierKey);

  const [statsRes, listResult, quota] = await Promise.all([
    supabase
      .from("admin_files")
      .select("file_size_bytes, category, created_at")
      .eq("business_id", user.businessId)
      .is("deleted_at", null),
    listAdminFiles(supabase, {
      businessId: user.businessId,
      category: effectiveCategory,
      q: q || undefined,
      sort: activeSort,
      limit: 50,
    }),
    loadStorageQuota(supabase, user.businessId, tierKey),
  ]);

  const allFiles = statsRes.data ?? [];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const categories = new Set(
    allFiles.map((f) => f.category).filter(Boolean),
  );

  const stats: AdminStorageStats = {
    totalFiles: allFiles.length,
    totalBytes: allFiles.reduce(
      (sum, f) => sum + Number(f.file_size_bytes ?? 0),
      0,
    ),
    categoryCount: categories.size,
    uploadedThisWeek: allFiles.filter(
      (f) => new Date(String(f.created_at)).getTime() >= weekAgo,
    ).length,
  };

  const nameLookup = await hydrateUploaderNames(supabase, listResult.rows);
  const fileIds = listResult.rows.map((r) => r.id);
  const usageByFileId = await loadFileUsageLinks(
    supabase,
    user.businessId,
    fileIds,
  );

  const rows: AdminStorageFileRow[] = listResult.rows.map((row) => ({
    id: row.id,
    file_name: row.file_name,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    category: row.category,
    description: row.description,
    tags: row.tags,
    created_at: row.created_at,
    uploaded_by: row.uploaded_by,
    uploader_name: nameLookup.get(row.uploaded_by) ?? null,
  }));

  const employees = canManageHrCore(user.role)
    ? (await loadHrEmployees(user.businessId))
        .filter((employee) => employee.status === "active")
        .map((employee) => ({
          id: employee.id,
          full_name: employee.full_name,
          role_title: employee.role_title,
        }))
    : [];

  const employeeDocumentTypesByEmployeeId: Record<string, string[]> = {};
  if (canManageHrCore(user.role)) {
    const hrDocuments = await loadHrDocuments(user.businessId);
    for (const doc of hrDocuments) {
      if (!doc.admin_file_id) continue;
      const existing = employeeDocumentTypesByEmployeeId[doc.employee_id] ?? [];
      if (!existing.includes(doc.document_type)) {
        existing.push(doc.document_type);
      }
      employeeDocumentTypesByEmployeeId[doc.employee_id] = existing;
    }
  }

  return (
    <AdminStoragePanel
      rows={rows}
      nextCursor={listResult.nextCursor}
      stats={stats}
      quota={{
        usedBytes: quota.usedBytes,
        quotaGb: quota.quotaGb,
        usagePct: quota.usagePct,
        isUnlimited: quota.isUnlimited || tier?.quotas.storageGb === Number.POSITIVE_INFINITY,
      }}
      usageByFileId={usageByFileId}
      hrDocsOnly={hrDocsOnly}
      query={q}
      activeCategory={effectiveCategory}
      activeSort={activeSort}
      errorMessage={statsRes.error?.message ?? null}
      defaultUploadCategory={defaultUploadCategory}
      employees={employees}
      employeeDocumentTypesByEmployeeId={employeeDocumentTypesByEmployeeId}
    />
  );
}
