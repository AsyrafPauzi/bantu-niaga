"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Banknote,
  Boxes,
  Lock,
  Megaphone,
  ShoppingCart,
  Users,
  Sparkles,
  Store,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import type { TierKey } from "@/lib/settings/plans";
import {
  hasPillar,
  minimumTierFor,
  type Pillar,
} from "@/lib/auth/entitlements";
import { tierBy } from "@/lib/settings/plans";

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, the sidebar checks the current tier against this pillar. */
  pillar?: Pillar;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Modules",
    items: [
      { href: "/admin", label: "Admin", icon: FileText, pillar: "admin" },
      { href: "/finance", label: "Finance", icon: Banknote, pillar: "finance" },
      {
        href: "/operations",
        label: "Operations",
        icon: Boxes,
        pillar: "operations",
      },
      {
        href: "/marketing",
        label: "Marketing",
        icon: Megaphone,
        pillar: "marketing",
      },
      { href: "/sales", label: "Sales", icon: ShoppingCart, pillar: "sales" },
      { href: "/hr", label: "HR", icon: Users, pillar: "hr" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/boardroom", label: "AI Boardroom", icon: Sparkles },
      { href: "/marketplace", label: "Marketplace", icon: Store },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function DesktopShell({
  tier,
  children,
}: {
  tier: TierKey;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface-light text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="flex">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-hairline-light bg-panel-light dark:border-hairline-dark dark:bg-panel-dark sticky top-0 h-dvh">
          <div className="px-5 py-5 border-b border-cream-200 bg-brand-50 dark:border-hairline-dark dark:bg-brand-900/30">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/icon.png"
                alt="Bantu Niaga"
                width={48}
                height={48}
                priority
                className="h-11 w-11 shrink-0"
              />
              <div className="leading-tight min-w-0">
                <p className="text-lg font-bold tracking-tight">
                  <span className="text-brand-700 dark:text-brand-200">Bantu</span>{" "}
                  <span className="text-accent-500">Niaga</span>
                </p>
                <p className="text-[10px] text-ink-muted dark:text-cream-400 mt-0.5 truncate">
                  SME-OS · All-in-One
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.label} className="mb-5">
                <p className="px-5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
                  {group.label}
                </p>
                <ul>
                  {group.items.map(({ href, label, icon: Icon, pillar }) => {
                    const active =
                      href === "/"
                        ? pathname === "/"
                        : pathname === href || pathname.startsWith(`${href}/`);
                    const locked = pillar ? !hasPillar(tier, pillar) : false;
                    const minTier = locked
                      ? tierBy(minimumTierFor(pillar!))
                      : null;
                    const lockedHref = locked
                      ? `/settings/subscription?locked=${pillar}`
                      : href;
                    return (
                      <li key={href}>
                        <Link
                          href={lockedHref}
                          title={
                            locked
                              ? `Available on ${minTier?.label ?? "a higher"} plan`
                              : undefined
                          }
                          className={cn(
                            "flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors border-l-4",
                            active
                              ? "bg-brand-50 text-brand-700 font-semibold border-accent-500 dark:bg-brand-900/30 dark:text-brand-200"
                              : locked
                                ? "text-ink-subtle hover:bg-cream-100 hover:text-ink-muted border-transparent dark:text-cream-500 dark:hover:bg-hairline-dark/60"
                                : "text-ink-muted hover:bg-cream-100 hover:text-ink border-transparent dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100",
                          )}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                            <span className="truncate">{label}</span>
                          </span>
                          {locked ? (
                            <Lock
                              className="h-3.5 w-3.5 shrink-0 text-ink-subtle dark:text-cream-500"
                              strokeWidth={2}
                              aria-label="Locked on this plan"
                            />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-cream-200 px-3 py-3 dark:border-hairline-dark">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-6 py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
