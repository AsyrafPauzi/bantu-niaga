"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  CircleHelp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSidebarCollapsed } from "@/lib/navigation/use-sidebar-collapsed";
import type { BusinessType } from "@/lib/onboarding/plan-quiz";
import { getOperationsNavSubItems } from "@/lib/operations/vertical";
import { signOutAction } from "@/app/sign-in/actions";
import type { TierKey } from "@/lib/settings/plans";
import type { BusinessMembership } from "@/lib/auth/memberships";
import { CompanySwitcher } from "@/components/shells/CompanySwitcher";
import {
  hasPillar,
  minimumTierFor,
  type Pillar,
} from "@/lib/auth/entitlements";
import { tierBy } from "@/lib/settings/plans";
import { isAssistantChatRoute } from "@/lib/navigation/assistant-routes";
import type { SidebarAssistantsByModule } from "@/lib/navigation/sidebar-assistants";

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
          { href: "/admin/storage", label: "Storage" },
          { href: "/admin/tasks", label: "Tasks" },
          { href: "/admin/compliance", label: "Compliance" },
          { href: "/admin/documents", label: "Templates & notes" },
        ],
      },
      {
        href: "/finance",
        label: "Finance",
        icon: Banknote,
        pillar: "finance",
        subItems: [
          { href: "/finance/invoices", label: "Invoices" },
          { href: "/finance/income", label: "Income" },
          { href: "/finance/expenses", label: "Expenses" },
          { href: "/finance/reports", label: "Reports" },
          { href: "/finance/customers", label: "Customers" },
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
          { href: "/operations/services", label: "Services" },
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
          { href: "/hr", label: "Overview" },
          { href: "/hr/employees", label: "Employees" },
          { href: "/hr/leave", label: "Leave" },
          { href: "/hr/holidays", label: "Public holidays" },
        ],
      },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/boardroom", label: "Boardroom", icon: Sparkles },
      { href: "/marketplace", label: "Marketplace", icon: Store },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isSidebarSectionActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/hr") {
    return pathname === "/hr" || pathname.startsWith("/hr/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopShell({
  tier,
  memberships,
  canCreateCompany,
  sidebarAssistants = {},
  businessType = "other",
  children,
}: {
  tier: TierKey;
  memberships: BusinessMembership[];
  canCreateCompany: boolean;
  sidebarAssistants?: SidebarAssistantsByModule;
  businessType?: BusinessType;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar, ready: sidebarReady } =
    useSidebarCollapsed();
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const sidebarGroups = useMemo(() => {
    const opsSubItems = getOperationsNavSubItems(businessType);
    return SIDEBAR_GROUPS.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === "/operations"
          ? { ...item, subItems: opsSubItems }
          : item,
      ),
    }));
  }, [businessType]);

  useEffect(() => {
    for (const group of sidebarGroups) {
      for (const item of group.items) {
        if (isSidebarSectionActive(item.href, pathname)) {
          setExpandedSections((prev) => ({ ...prev, [item.href]: true }));
          return;
        }
      }
    }
  }, [pathname, sidebarGroups]);

  const isAssistantRoute = isAssistantChatRoute(pathname);

  const pageContentClass = cn(
    "mx-auto h-full min-h-0 overflow-y-auto px-4 py-4 sm:px-6 lg:px-10 lg:py-6",
    sidebarCollapsed ? "max-w-none" : "max-w-6xl",
    sidebarCollapsed && "pt-14",
  );

  return (
    <div className="h-dvh overflow-hidden bg-surface-light text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="flex h-dvh min-h-0 overflow-hidden">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-[#E5E0D8] bg-white transition-[width,border-color] duration-300 ease-in-out dark:border-hairline-dark dark:bg-panel-dark lg:flex",
            sidebarCollapsed ? "w-0 border-r-0" : "w-[272px]",
            !sidebarReady && "w-[272px]",
          )}
          aria-hidden={sidebarCollapsed}
        >
          <div className="flex w-[272px] shrink-0 flex-col h-full">
          <div className="border-b border-[#D5E2FB] bg-[#EEF3FE] px-5 py-5 dark:border-hairline-dark dark:bg-brand-900/30">
            <div className="flex items-start justify-between gap-2">
              <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
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
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-white/80 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="border-b border-[#D5E2FB] bg-[#EEF3FE] px-4 py-3 dark:border-hairline-dark dark:bg-brand-900/30">
            <CompanySwitcher
              memberships={memberships}
              canCreateCompany={canCreateCompany}
            />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {sidebarGroups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
                  {group.label}
                </p>
                <ul>
                  {group.items.map(
                    ({ href, label, icon: Icon, pillar, subItems }) => {
                      const isOverviewActive = pathname === href;
                      const isSectionActive = isSidebarSectionActive(
                        href,
                        pathname,
                      );
                      const locked = pillar ? !hasPillar(tier, pillar) : false;
                      const minTier = locked
                        ? tierBy(minimumTierFor(pillar!))
                        : null;
                      const lockedHref = locked
                        ? `/settings/subscription?locked=${pillar}`
                        : href;
                      const visibleSubItems = [
                        ...(subItems?.filter(
                          (sub) =>
                            !(
                              tier === "starter" &&
                              sub.href === "/finance/expenses"
                            ),
                        ) ?? []),
                        ...(sidebarAssistants[href] ?? []),
                      ];
                      const hasSubItems =
                        !locked && visibleSubItems.length > 0;
                      const isExpanded =
                        expandedSections[href] ?? isSectionActive;
                      const showSubItems = hasSubItems && isExpanded;
                      return (
                        <li key={href}>
                          <div className="flex items-stretch gap-0.5">
                            <Link
                              href={lockedHref}
                              title={
                                locked
                                  ? `Available on ${minTier?.label ?? "a higher"} plan`
                                  : undefined
                              }
                              className={cn(
                                "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                                isOverviewActive
                                  ? "bg-[#EEF3FE] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                                  : isSectionActive && !locked
                                    ? "font-semibold text-brand-700 dark:text-brand-200"
                                    : locked
                                      ? "text-ink-subtle hover:bg-cream-100 hover:text-ink-muted dark:text-cream-500 dark:hover:bg-hairline-dark/60"
                                      : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100",
                              )}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <Icon
                                  className="h-4 w-4 shrink-0"
                                  strokeWidth={2}
                                />
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
                            {hasSubItems ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSections((prev) => ({
                                    ...prev,
                                    [href]: !isExpanded,
                                  }))
                                }
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label} submenu`}
                                className={cn(
                                  "flex shrink-0 items-center justify-center rounded-lg px-2 py-2.5 text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100",
                                  isSectionActive &&
                                    !locked &&
                                    "text-brand-700 dark:text-brand-200",
                                )}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    isExpanded && "rotate-180",
                                  )}
                                  strokeWidth={2}
                                />
                              </button>
                            ) : null}
                          </div>
                          {showSubItems ? (
                            <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-[#E5E0D8] pl-3 dark:border-hairline-dark">
                              {visibleSubItems.map((sub) => {
                                const subActive =
                                  sub.href === "/hr"
                                    ? pathname === "/hr"
                                    : pathname === sub.href ||
                                      pathname.startsWith(`${sub.href}/`);
                                return (
                                  <li key={sub.href}>
                                    <Link
                                      href={sub.href}
                                      className={cn(
                                        "block rounded-md py-1.5 pl-2 pr-2 text-[13px] transition-colors",
                                        subActive
                                          ? "bg-[#EEF3FE] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                                          : "text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100",
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

          <div className="space-y-1.5 border-t border-[#E5E0D8] p-3 dark:border-hairline-dark">
            <p className="flex items-center gap-2 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-2 text-[11px] leading-snug text-[#C2410C]/90 dark:border-accent-900/40 dark:bg-accent-900/20 dark:text-accent-200/80">
              <CircleHelp
                className="h-3.5 w-3.5 shrink-0 text-[#C2410C] dark:text-accent-300"
                strokeWidth={2}
              />
              <span>
                <span className="font-semibold text-[#C2410C] dark:text-accent-300">
                  Need help?
                </span>{" "}
                Use the help button on any page.
              </span>
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                <span>Sign out</span>
              </button>
            </form>
          </div>
          </div>
        </aside>

        <main
          className={cn(
            "relative min-h-0 min-w-0 flex-1",
            isAssistantRoute
              ? "flex min-h-0 flex-col overflow-hidden"
              : "overflow-hidden",
          )}
        >
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E0D8] bg-white text-ink-muted shadow-sm transition-colors hover:bg-cream-100 hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100 lg:flex"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
          <div
            className={cn(
              isAssistantRoute
                ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                : pageContentClass,
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
