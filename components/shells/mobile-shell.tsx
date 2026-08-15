"use client";

import Link from "next/link";
import { NiagaXLogo } from "@/components/brand/NiagaXLogo";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Lock, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import type { TierKey } from "@/lib/settings/plans";
import type { BusinessMembership } from "@/lib/auth/memberships";
import { CompanySwitcher } from "@/components/shells/CompanySwitcher";
import { MobileNavDrawer } from "@/components/shells/MobileNavDrawer";
import { hasPillar } from "@/lib/auth/entitlements";
import { isAssistantChatRoute } from "@/lib/navigation/assistant-routes";
import {
  getMobileBottomTabsForRole,
  mobileBottomTabGridClass,
  mobileTabActive,
} from "@/lib/navigation/app-nav";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import type { Role } from "@/lib/permissions";

export function MobileShell({
  tier,
  memberships,
  canCreateCompany,
  businessType = "other",
  role = "manager",
  children,
}: {
  tier: TierKey;
  memberships: BusinessMembership[];
  canCreateCompany: boolean;
  businessType?: BusinessType;
  role?: Role;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAssistantRoute = isAssistantChatRoute(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomTabs = getMobileBottomTabsForRole(role);
  const tabGridClass = mobileBottomTabGridClass(bottomTabs.length);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-light text-ink dark:bg-surface-dark dark:text-cream-100">
      <header className="sticky top-0 z-30 bg-brand-50/95 backdrop-blur border-b border-brand-100 dark:bg-brand-900/40 dark:border-hairline-dark">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/40"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center" aria-label="NiagaX home">
            <NiagaXLogo className="truncate text-base" />
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-2 text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/40"
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
            </button>
          </form>
        </div>
        <div className="border-t border-brand-100 px-4 pb-3 pt-2 dark:border-hairline-dark">
          <CompanySwitcher
            memberships={memberships}
            compact
            canCreateCompany={canCreateCompany}
          />
        </div>
      </header>

      <main
        className={cn(
          "flex-1 min-h-0",
          isAssistantRoute
            ? "flex flex-col overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
            : "px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]",
        )}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline-light bg-panel-light/95 backdrop-blur dark:border-hairline-dark dark:bg-panel-dark/95"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary"
      >
        <ul className={cn("grid", tabGridClass)}>
          {bottomTabs.map((tab) => {
            const active = mobileTabActive(tab, pathname, menuOpen);
            const Icon = tab.icon;

            if (tab.kind === "menu") {
              return (
                <li key="menu" className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-expanded={menuOpen}
                    aria-label="Open full menu"
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1 py-2 min-h-tap-min text-xs",
                      active
                        ? "text-brand-700 dark:text-brand-200"
                        : "text-ink-muted dark:text-cream-400",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-500"
                      />
                    ) : null}
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className={cn(active && "font-semibold")}>
                      {tab.label}
                    </span>
                  </button>
                </li>
              );
            }

            const locked = tab.pillar ? !hasPillar(tier, tab.pillar) : false;
            const href = locked
              ? `/settings/subscription?locked=${tab.pillar}`
              : tab.href;

            return (
              <li key={tab.href} className="relative">
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 min-h-tap-min text-xs",
                    active
                      ? "text-brand-700 dark:text-brand-200"
                      : locked
                        ? "text-ink-subtle dark:text-cream-500"
                        : "text-ink-muted dark:text-cream-400",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-500"
                    />
                  ) : null}
                  <span className="relative">
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={active ? 2.4 : 2}
                    />
                    {locked ? (
                      <Lock
                        className="absolute -bottom-1 -right-1 h-3 w-3 text-ink-subtle dark:text-cream-500"
                        strokeWidth={2.5}
                      />
                    ) : null}
                  </span>
                  <span className={cn(active && "font-semibold")}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <MobileNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        tier={tier}
        businessType={businessType}
      />
    </div>
  );
}
