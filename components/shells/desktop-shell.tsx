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

interface SidebarSubItem {
  href: string;
  label: string;
}

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, the sidebar checks the current tier against this pillar. */
  pillar?: Pillar;
  /** Optional sub-pages, shown indented when the parent is the active section. */
  subItems?: readonly SidebarSubItem[];
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
      {
        href: "/admin",
        label: "Admin",
        icon: FileText,
        pillar: "admin",
        subItems: [
          { href: "/admin/documents", label: "Documents" },
          { href: "/admin/storage", label: "Storage" },
          { href: "/admin/tasks", label: "Tasks" },
          { href: "/admin/compliance", label: "Compliance" },
        ],
      },
      {
        href: "/finance",
        label: "Finance",
        icon: Banknote,
        pillar: "finance",
        subItems: [
          { href: "/finance/invoices", label: "Invoices" },
          { href: "/finance/expenses", label: "Expenses" },
          { href: "/finance/ledger", label: "Ledger" },
        ],
      },
      {
        href: "/operations",
        label: "Operations",
        icon: Boxes,
        pillar: "operations",
        subItems: [
          { href: "/operations/orders", label: "Orders" },
          { href: "/operations/products", label: "Products" },
          { href: "/operations/bookings", label: "Bookings" },
          { href: "/operations/suppliers", label: "Suppliers" },
        ],
      },
      {
        href: "/marketing",
        label: "Marketing",
        icon: Megaphone,
        pillar: "marketing",
        subItems: [
          { href: "/marketing/customers", label: "Customers" },
          { href: "/marketing/segments", label: "Segments" },
          { href: "/marketing/content", label: "Content" },
          { href: "/marketing/broadcasts", label: "Broadcasts" },
          { href: "/marketing/coupons", label: "Coupons" },
        ],
      },
      {
        href: "/sales",
        label: "Sales",
        icon: ShoppingCart,
        pillar: "sales",
        subItems: [
          { href: "/sales/pos", label: "POS" },
          { href: "/sales/leads", label: "Leads" },
        ],
      },
      {
        href: "/hr",
        label: "HR",
        icon: Users,
        pillar: "hr",
        subItems: [
          { href: "/hr/employees", label: "Employees" },
          { href: "/hr/leave", label: "Leave" },
        ],
      },
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
                  {group.items.map(
                    ({ href, label, icon: Icon, pillar, subItems }) => {
                      const isOverviewActive = pathname === href;
                      const isSectionActive =
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
                      const visibleSubItems = subItems?.filter(
                        (sub) =>
                          !(tier === "starter" && sub.href === "/finance/expenses"),
                      );
                      const showSubItems =
                        !locked &&
                        visibleSubItems &&
                        visibleSubItems.length > 0 &&
                        isSectionActive;
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
                              isOverviewActive
                                ? "bg-brand-50 text-brand-700 font-semibold border-accent-500 dark:bg-brand-900/30 dark:text-brand-200"
                                : isSectionActive && !locked
                                  ? "text-brand-700 font-semibold border-transparent dark:text-brand-200"
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
                          {showSubItems ? (
                            <ul className="mb-1 mt-0.5 ml-9 mr-3 border-l border-cream-200 dark:border-hairline-dark">
                              {visibleSubItems!.map((sub) => {
                                const subActive =
                                  pathname === sub.href ||
                                  pathname.startsWith(`${sub.href}/`);
                                return (
                                  <li key={sub.href}>
                                    <Link
                                      href={sub.href}
                                      className={cn(
                                        "block py-1.5 pl-3 pr-2 text-[13px] transition-colors -ml-px border-l-2",
                                        subActive
                                          ? "text-brand-700 font-semibold border-accent-500 dark:text-brand-200"
                                          : "text-ink-muted hover:text-ink border-transparent dark:text-cream-400 dark:hover:text-cream-100",
                                      )}
                                    >
                                      {sub.label}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </li>
                      );
                    },
                  )}
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
