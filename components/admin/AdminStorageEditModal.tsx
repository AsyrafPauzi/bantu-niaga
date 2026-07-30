"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  ADMIN_FILE_CATEGORIES,
  ADMIN_FILE_MAX_TAGS,
  type AdminFileCategory,
} from "@/lib/admin/schemas";
import { STORAGE_CATEGORY_LABELS } from "@/lib/admin/storage-shared";
import type { AdminStorageFileRow } from "@/components/admin/AdminStoragePanel";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface AdminStorageEditModalProps {
  file: AdminStorageFileRow;
  hrDocsOnly: boolean;
  onClose: () => void;
  onSaved: (row: AdminStorageFileRow) => void;
}

function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, ADMIN_FILE_MAX_TAGS);
}

export function AdminStorageEditModal({
  file,
  hrDocsOnly,
  onClose,
  onSaved,
}: AdminStorageEditModalProps) {
  const [fileName, setFileName] = useState(file.file_name);
  const [category, setCategory] = useState<AdminFileCategory | "">(
    file.category && (ADMIN_FILE_CATEGORIES as readonly string[]).includes(file.category)
      ? (file.category as AdminFileCategory)
      : "",
  );
  const [description, setDescription] = useState(file.description ?? "");
  const [tagsInput, setTagsInput] = useState((file.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/storage/${file.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file_name: fileName.trim(),
          category: hrDocsOnly ? "hr_doc" : category || null,
          description: description.trim() || null,
          tags: parseTagsInput(tagsInput),
        }),
      });
      const body = (await res.json().catch(() => null)) as ApiEnvelope<{
        id: string;
        file_name: string;
        category: string | null;
        description: string | null;
        tags: string[];
      }> | null;
      if (!res.ok || !body?.data) {
        setError(body?.error?.message ?? "Could not save changes.");
        return;
      }
      onSaved({
        ...file,
        file_name: body.data.file_name,
        category: body.data.category,
        description: body.data.description,
        tags: body.data.tags ?? [],
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-edit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <h2
            id="storage-edit-title"
            className="text-sm font-semibold text-ink dark:text-cream-100"
          >
            Edit file details
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
            File name
            <input
              type="text"
              value={fileName}
              maxLength={255}
              onChange={(e) => setFileName(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-normal text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>

          {!hrDocsOnly ? (
            <label className="block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Category
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as AdminFileCategory | "")
                }
                disabled={busy}
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-normal text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              >
                <option value="">No category</option>
                {ADMIN_FILE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {STORAGE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
            Description
            <textarea
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-normal text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>

          {!hrDocsOnly ? (
            <label className="block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400">
              Tags (comma-separated, max {ADMIN_FILE_MAX_TAGS})
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                disabled={busy}
                placeholder="e.g. q3, audit, ssm"
                className="w-full rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-normal text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
              />
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-status-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-cream-200 px-5 py-4 dark:border-hairline-dark">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || !fileName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
