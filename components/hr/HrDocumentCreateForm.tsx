"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_FILE_MAX_BYTES } from "@/lib/admin/schemas";
import type { HrEmployeeRow } from "@/lib/hr/load";

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

const labelClass =
  "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400";

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
}: {
  employees: HrEmployeeRow[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    const formData = new FormData(form);
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!file || file.size <= 0) {
      setMessage("Choose a file to upload.");
      setBusy(false);
      return;
    }
    if (file.size > ADMIN_FILE_MAX_BYTES) {
      setMessage(
        `File too large (${formatBytes(file.size)}). Maximum upload size is 100 MB.`,
      );
      setBusy(false);
      return;
    }
    const employeeId = String(formData.get("employee_id") ?? "");
    const documentType = String(formData.get("document_type") ?? "");
    const label =
      String(formData.get("label") ?? "").trim() ||
      `${documentType.toUpperCase()} - ${file.name}`;

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
        setMessage(initJson?.error?.message ?? "Could not prepare the upload.");
        return;
      }

      const uploadRes = await fetch(initJson.data.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        setMessage("Could not upload the file. Please try again.");
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
        setMessage(confirmJson?.error?.message ?? "Could not save the uploaded file.");
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
        setMessage(json?.message ?? json?.error ?? "Could not add document.");
        return;
      }
      form.reset();
      setMessage("Document uploaded and linked to employee.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-ink-muted dark:text-cream-400">
        Upload here once. The file will also appear in Admin Storage under HR
        documents for this account.
      </p>
      <label className={labelClass}>
        Employee
        <select name="employee_id" required className={inputClass}>
          <option value="">Choose employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Document type
        <select name="document_type" required className={inputClass}>
          <option value="ic">IC</option>
          <option value="passport">Passport</option>
          <option value="bank">Bank</option>
          <option value="medical">Medical</option>
          <option value="contract">Contract</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className={labelClass}>
        Document label
        <input
          name="label"
          maxLength={160}
          placeholder="Optional label"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Document file
        <input
          name="file"
        ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
          className={inputClass}
        />
      </label>
      {message ? <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p> : null}
      <button
        type="submit"
        disabled={busy || employees.length === 0}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? "Adding..." : "Add document record"}
      </button>
    </form>
  );
}
