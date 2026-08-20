"use client";

import { useTranslations } from "next-intl";

const NAV_HEAD_KEYS: Record<string, string> = {
  Finance: "finance",
  Operations: "operations",
  Sales: "sales",
  Marketing: "marketing",
  HR: "hr",
  Admin: "admin",
  Boardroom: "boardroom",
  Marketplace: "marketplace",
  Settings: "settings",
};

/** Localizes the module eyebrow (e.g. "Admin · Storage") without forcing the parent tree client-side. */
export function ModuleNavLabel({ module }: { module: string }) {
  const tNav = useTranslations("nav");
  const parts = module.split(" · ");
  const head = parts[0]?.trim() ?? module;
  const key = NAV_HEAD_KEYS[head];
  if (!key) return <>{module}</>;
  const localizedHead = tNav(key);
  if (parts.length === 1) return <>{localizedHead}</>;
  return (
    <>
      {localizedHead} · {parts.slice(1).join(" · ")}
    </>
  );
}
