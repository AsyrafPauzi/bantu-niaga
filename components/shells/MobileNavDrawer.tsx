"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, LogOut, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Tooltip } from "@/components/ui/tooltip";
import { navGroupMessageKey, navLabelFor } from "@/lib/i18n/nav-labels";

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
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const groups = buildAppNavGroups(businessType);

  // Only expand the section that contains the current route; all others collapsed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const group of groups) {
      for (const item of group.items) {
        if (isNavSectionActive(item.href, pathname)) {
          init[item.href] = true;
        }
      }
    }
    return init;
  });

  function toggle(href: string) {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  // Track whether we are in the closing animation phase.
  const [visible, setVisible] = useState(open);
  const [animatingOut, setAnimatingOut] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      // Cancel any pending close animation and show immediately.
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setAnimatingOut(false);
      setVisible(true);
    } else if (visible) {
      // Trigger slide-out then unmount after animation completes (250 ms).
      setAnimatingOut(true);
      closeTimer.current = setTimeout(() => {
        setVisible(false);
        setAnimatingOut(false);
      }, 250);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
    return undefined;
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      {/* Backdrop — fades in / out */}
      <button
        type="button"
        aria-label={tShell("closeMenu")}
        className={cn(
          "absolute inset-0 bg-ink/40 backdrop-blur-[2px]",
          animatingOut ? "animate-drawer-backdrop-out" : "animate-drawer-backdrop-in",
        )}
        onClick={onClose}
      />
      {/* Panel — slides in from left / out to left */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(100%,288px)] flex-col bg-white shadow-2xl dark:bg-panel-dark",
          animatingOut ? "animate-drawer-slide-out" : "animate-drawer-slide-in",
        )}
        aria-label={tShell("appMenu")}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
          <p className="text-sm font-bold text-ink dark:text-cream-100">
            {tShell("allPages")}
          </p>
          <Tooltip content="Close" side="left">
            <button
              type="button"
              onClick={onClose}
              aria-label={tShell("closeMenu")}
              className="rounded-lg p-2 text-ink-muted hover:bg-cream-100 dark:text-cream-400 dark:hover:bg-hairline-dark/60"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </Tooltip>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group: NavGroup) => {
            const groupKey = navGroupMessageKey(group.label);
            return (
              <div key={group.label} className="mb-5 last:mb-0">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-500">
                  {groupKey ? tNav(groupKey) : group.label}
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
                        <div className="flex items-stretch gap-0.5">
                          <Link
                            href={href}
                            onClick={onClose}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                              sectionActive && !locked
                                ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                                : locked
                                  ? "text-ink-subtle dark:text-cream-500"
                                  : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60",
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                            <span className="min-w-0 flex-1 truncate">
                              {navLabelFor(item.href, item.label, tNav)}
                            </span>
                            {locked ? (
                              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                            ) : null}
                          </Link>
                          {item.subItems && item.subItems.length > 0 && !locked ? (
                            <button
                              type="button"
                              onClick={() => toggle(item.href)}
                              aria-expanded={!!expanded[item.href]}
                              aria-label={expanded[item.href] ? "Collapse" : "Expand"}
                              className={cn(
                                "flex shrink-0 items-center justify-center rounded-lg px-2 py-2.5 text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60",
                                sectionActive && "text-brand-700 dark:text-brand-200",
                              )}
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  expanded[item.href] && "rotate-180",
                                )}
                                strokeWidth={2}
                              />
                            </button>
                          ) : null}
                        </div>

                        {item.subItems && item.subItems.length > 0 && !locked && expanded[item.href] ? (
                          <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-cream-200 pl-3 dark:border-hairline-dark">
                            {item.subItems.map((sub) => {
                              const subActive = isNavSubItemActive(sub.href, pathname);
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
                                    {navLabelFor(sub.href, sub.label, tNav)}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}

                        {locked && minTier ? (
                          <p className="ml-10 pb-1 text-[10px] text-ink-subtle dark:text-cream-500">
                            {tShell("planSuffix", { plan: minTier.label })}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-cream-200 p-3 dark:border-hairline-dark">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              {tShell("signOut")}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
