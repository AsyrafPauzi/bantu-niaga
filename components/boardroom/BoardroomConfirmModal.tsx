"use client";

import { Loader2 } from "lucide-react";

export function BoardroomConfirmModal({
  loading,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-panel-dark">
        <h3 className="text-lg font-bold text-ink dark:text-cream-100">
          Replace paused meeting?
        </h3>
        <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
          Starting fresh will end your paused session. It stays in history.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold dark:border-hairline-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start new"}
          </button>
        </div>
      </div>
    </div>
  );
}
