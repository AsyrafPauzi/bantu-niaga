"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Lock, LogOut, X } from "lucide-react";
import { signOutAction } from "@/app/sign-in/actions";
import {
  hasPillar,
  minimumTierFor,
  type Pillar,
} from "@/lib/auth/entitlements";
import {
  buildAppNavGroups,
  isNavSectionActive,
  isNavSubItemActive,
  type NavGroup,
} from "@/lib/navigation/app-nav";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import { tierBy, type TierKey } from "@/lib/settings/plans";
import { cn } from "@/lib/utils/cn";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  tier: TierKey;
  businessType?: BusinessType;
}

function lockedHref(pillar: Pillar): string {
  return `/settings/subscription?locked=${pillar}`;
}

export function MobileNavDrawer({
  open,
  onClose,
  tier,
  businessType = "other",
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const groups = buildAppNavGroups(businessType);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 left-0 flex w-[min(100%,288px)] flex-col bg-white shadow-2xl dark:bg-panel-dark"
        aria-label="App menu"
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
          <p className="text-sm font-bold text-ink dark:text-cream-100">
            All pages
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-2 text-ink-muted hover:bg-cream-100 dark:text-cream-400 dark:hover:bg-hairline-dark/60"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group: NavGroup) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const locked = item.pillar
                    ? !hasPillar(tier, item.pillar)
                    : false;
                  const minTier = locked
                    ? tierBy(minimumTierFor(item.pillar!))
                    : null;
                  const sectionActive = isNavSectionActive(
                    item.href,
                    pathname,
                  );
                  const href = locked ? lockedHref(item.pillar!) : item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          sectionActive && !locked
                            ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                            : locked
                              ? "text-ink-subtle dark:text-cream-500"
                              : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {locked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                        ) : null}
                      </Link>
                      {item.subItems && item.subItems.length > 0 && !locked ? (
                        <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-cream-200 pl-3 dark:border-hairline-dark">
                          {item.subItems.map((sub) => {
                            const subActive = isNavSubItemActive(
                              sub.href,
                              pathname,
                            );
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href}
                                  onClick={onClose}
                                  className={cn(
                                    "block rounded-md py-2 pl-2 pr-2 text-[13px] transition-colors",
                                    subActive
                                      ? "font-semibold text-brand-700 dark:text-brand-200"
                                      : "text-ink-muted hover:text-ink dark:text-cream-400",
                                  )}
                                >
                                  {sub.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      {locked && minTier ? (
                        <p className="ml-10 pb-1 text-[10px] text-ink-subtle dark:text-cream-500">
                          {minTier.label} plan
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-cream-200 p-3 dark:border-hairline-dark">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
