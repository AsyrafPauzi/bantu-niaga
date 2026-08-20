"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";

export function SettingsSubpageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("settings");
  const isIndex = pathname === "/settings";

  if (isIndex) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className={cn("inline-flex items-center gap-1.5 text-sm", settingsClasses.link)}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        {t("backToSettings")}
      </Link>
      {children}
    </div>
  );
}
