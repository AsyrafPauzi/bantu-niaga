"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function SettingsSubpageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === "/settings";

  if (isIndex) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>
      {children}
    </div>
  );
}
