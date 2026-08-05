"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HrToast } from "@/components/hr/HrToast";
import { ADMIN_FILE_MAX_BYTES } from "@/lib/admin/schemas";
import type { HrEmployeeRow } from "@/lib/hr/load";
import { documentTypeLabel } from "@/lib/hr/profile-completion";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface UploadInitResponse {
  upload_url: string;
  storage_path: string;
}

interface ConfirmResponse {
  id: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HrDocumentCreateForm({
  employees,
  defaultEmployeeId,
  hideEmployeeSelect,
}: {
  employees: HrEmployeeRow[];
  defaultEmployeeId?: string;
  hideEmployeeSelect?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    const formData = new FormData(form);
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!file || file.size <= 0) {
      setToast({ kind: "err", message: "Choose a file to upload." });
      setBusy(false);
      return;
    }
    if (file.size > ADMIN_FILE_MAX_BYTES) {
      setToast({
        kind: "err",
        message: `File too large (${formatBytes(file.size)}). Maximum is 100 MB.`,
      });
      setBusy(false);
      return;
    }
    const employeeId =
      defaultEmployeeId ?? String(formData.get("employee_id") ?? "");
    const documentType = String(formData.get("document_type") ?? "");
    const label =
      String(formData.get("label") ?? "").trim() ||
      `${documentTypeLabel(documentType)} — ${file.name}`;

    try {
      const initRes = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          category: "hr_doc",
          description: label,
        }),
      });
      const initJson = (await initRes.json().catch(() => null)) as
        | ApiEnvelope<UploadInitResponse>
        | null;
      if (!initRes.ok || !initJson?.data) {
        setToast({
          kind: "err",
          message: initJson?.error?.message ?? "Could not prepare the upload.",
        });
        return;
      }

      const uploadRes = await fetch(initJson.data.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        setToast({ kind: "err", message: "Upload failed. Please try again." });
        return;
      }

      const confirmRes = await fetch("/api/admin/storage/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: initJson.data.storage_path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          category: "hr_doc",
          description: label,
        }),
      });
      const confirmJson = (await confirmRes.json().catch(() => null)) as
        | ApiEnvelope<ConfirmResponse>
        | null;
      if (!confirmRes.ok || !confirmJson?.data) {
        setToast({
          kind: "err",
          message: confirmJson?.error?.message ?? "Could not save the file.",
        });
        return;
      }

      const res = await fetch("/api/hr/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          document_type: documentType,
          label,
          admin_file_id: confirmJson.data.id,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setToast({
          kind: "err",
          message: json?.message ?? json?.error ?? "Could not link the file.",
        });
        return;
      }
      form.reset();
      setToast({ kind: "ok", message: "File uploaded" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className={hrClasses.sectionHint}>
          Upload IC, bank proof, or contract PDFs. Files stay in your staff documents vault.
        </p>
        {hideEmployeeSelect && defaultEmployeeId ? (
          <input type="hidden" name="employee_id" value={defaultEmployeeId} />
        ) : (
          <label className={hrClasses.label}>
            Employee
            <select name="employee_id" required className={hrClasses.input} defaultValue={defaultEmployeeId}>
              <option value="">Choose employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={hrClasses.label}>
          File type
          <select name="document_type" required className={hrClasses.input} defaultValue="ic">
            <option value="ic">IC</option>
            <option value="passport">Passport</option>
            <option value="bank">Bank statement</option>
            <option value="medical">Medical</option>
            <option value="contract">Employment contract</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className={hrClasses.label}>
          Label <span className="font-normal text-ink-subtle">(optional)</span>
          <input name="label" maxLength={160} placeholder="e.g. IC front" className={hrClasses.input} />
        </label>
        <label className={hrClasses.label}>
          File
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            accept="image/*,application/pdf,.doc,.docx"
            className={hrClasses.input}
          />
        </label>
        <button
          type="submit"
          disabled={busy || employees.length === 0}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60",
            hrClasses.btnPrimary,
          )}
        >
          {busy ? "Uploading…" : "Upload file"}
        </button>
      </form>
      {toast ? (
        <HrToast message={toast.message} kind={toast.kind} onDismiss={() => setToast(null)} />
      ) : null}
    </>
  );
}
