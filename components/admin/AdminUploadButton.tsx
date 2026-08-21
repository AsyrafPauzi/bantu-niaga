"use client";

import { CloudUpload } from "lucide-react";

export function AdminUploadButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("admin:upload"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-brand-600 active:scale-[0.98]"
    >
      <CloudUpload className="h-4 w-4" />
      Upload
    </button>
  );
}
