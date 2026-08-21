"use client";

import { Plus } from "lucide-react";

export const ADMIN_ADD_TASK_EVENT = "admin:add-task";

export function AdminAddTaskButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent(ADMIN_ADD_TASK_EVENT));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-brand-600 active:scale-[0.98]"
    >
      <Plus className="h-4 w-4" />
      Add task
    </button>
  );
}
