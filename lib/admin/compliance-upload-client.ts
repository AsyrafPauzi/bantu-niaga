/**
 * Client-side upload helper for licence/permit certificates.
 * Files land in Admin Storage (category: compliance) and return the new row id.
 */

import {
  openAdminFileDownload,
  uploadAdminStorageFile,
  type AdminStorageUploadedFile,
} from "@/lib/admin/storage-upload-client";

export type ComplianceUploadedFile = AdminStorageUploadedFile;

export async function uploadComplianceLicenceDocument(
  file: File,
  licenceTitle: string,
  onProgress?: (pct: number) => void,
): Promise<ComplianceUploadedFile> {
  const description = `Licence certificate: ${licenceTitle}`.slice(0, 2000);
  return uploadAdminStorageFile(file, {
    category: "compliance",
    description,
    onProgress,
  });
}

export { openAdminFileDownload };
