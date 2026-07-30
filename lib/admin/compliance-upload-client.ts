/**
 * Client-side upload helper for licence/permit certificates.
 * Files land in Admin Storage (category: compliance) and return the new row id.
 */

import { ADMIN_FILE_MAX_BYTES } from "@/lib/admin/schemas";

export interface ComplianceUploadedFile {
  id: string;
  file_name: string;
}

interface UploadInitResponse {
  upload_url: string;
  storage_path: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { message?: string };
}

interface AdminFileRow {
  id: string;
  file_name: string;
}

export async function uploadComplianceLicenceDocument(
  file: File,
  licenceTitle: string,
  onProgress?: (pct: number) => void,
): Promise<ComplianceUploadedFile> {
  if (file.size <= 0) throw new Error("That file is empty.");
  if (file.size > ADMIN_FILE_MAX_BYTES) {
    throw new Error("File too large. Maximum upload size is 100 MB.");
  }

  const description = `Licence certificate: ${licenceTitle}`.slice(0, 2000);

  const initRes = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      category: "compliance",
      description,
    }),
  });

  if (!initRes.ok) {
    const body = (await initRes.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new Error(
      body?.error?.message ??
        (initRes.status === 413
          ? "File too large. Maximum upload size is 100 MB."
          : "Could not prepare the upload."),
    );
  }

  const initBody = (await initRes.json()) as ApiEnvelope<UploadInitResponse>;
  const init = initBody.data;
  if (!init) throw new Error("Server did not return an upload URL.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", init.upload_url, true);
    xhr.setRequestHeader(
      "content-type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0 && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });

  const confirmRes = await fetch("/api/admin/storage/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storage_path: init.storage_path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      category: "compliance",
      description,
    }),
  });

  if (!confirmRes.ok) {
    const body = (await confirmRes.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new Error(body?.error?.message ?? "Could not finalise the upload.");
  }

  const confirmBody = (await confirmRes.json()) as ApiEnvelope<AdminFileRow>;
  const row = confirmBody.data;
  if (!row?.id) throw new Error("Upload saved but file id was missing.");

  return { id: row.id, file_name: row.file_name };
}

export async function openAdminFileDownload(fileId: string): Promise<void> {
  const res = await fetch(`/api/admin/storage/${fileId}/download`);
  const json = (await res.json()) as ApiEnvelope<{ download_url: string }>;
  if (!res.ok || !json.ok || !json.data?.download_url) {
    throw new Error(json.error?.message ?? "Could not open the file.");
  }
  window.open(json.data.download_url, "_blank", "noopener,noreferrer");
}
