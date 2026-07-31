"use client";

import Link from "next/link";
import { Plus, Upload } from "lucide-react";

interface AdminMobileFabProps {
  canStorage?: boolean;
  canTasks?: boolean;
}

export function AdminMobileFab({
  canStorage = false,
  canTasks = false,
}: AdminMobileFabProps) {
  if (!canStorage && !canTasks) return null;

  const href = canStorage ? "/admin/storage" : "/admin/tasks";
  const label = canStorage ? "Upload" : "Add task";
  const Icon = canStorage ? Upload : Plus;

  return (
    <Link
      href={href}
      className="fixed bottom-20 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-600 lg:hidden"
      aria-label={label}
    >
      <Icon className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  );
}
