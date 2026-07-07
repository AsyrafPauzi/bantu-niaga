"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  UsersRound,
  Building2,
  FileClock,
  Crown,
  Store,
  Sparkles,
  LineChart,
  PlugZap,
  TrendingUp,
  Activity,
  ShieldCheck,
  ShieldAlert,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  caption: string;
  items: NavItem[];
}

const GROUPS: readonly NavGroup[] = [
  {
    caption: "OPERATE",
    items: [
      { href: "/super-admin", label: "Overview", icon: LayoutGrid },
      { href: "/super-admin/users", label: "Users", icon: UsersRound },
      { href: "/super-admin/businesses", label: "Businesses", icon: Building2 },
      { href: "/super-admin/privacy", label: "Privacy (DSR)", icon: ShieldAlert },
      { href: "/super-admin/audit", label: "Audit log", icon: FileClock },
    ],
  },
  {
    caption: "CATALOG",
    items: [
      { href: "/super-admin/plans", label: "Plans", icon: Crown },
      { href: "/super-admin/marketplace", label: "Marketplace", icon: Store },
      { href: "/super-admin/ai-agents", label: "AI Agents", icon: Sparkles },
      { href: "/super-admin/integrations", label: "Integrations", icon: PlugZap },
    ],
  },
  {
    caption: "INSIGHTS",
    items: [
      {
        href: "/super-admin/revenue",
        label: "Revenue",
        icon: TrendingUp,
      },
      {
        href: "/super-admin/tenant-health",
        label: "Tenant health",
        icon: Activity,
      },
      {
        href: "/super-admin/data-monitor",
        label: "Data monitor",
        icon: LineChart,
      },
      {
        href: "/super-admin/investor-metrics",
        label: "Investor metrics",
        icon: TrendingUp,
      },
    ],
  },
];

export interface SuperAdminShellProps {
  admin: { email: string; displayName: string | null };
  children: ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/super-admin") return pathname === "/super-admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SuperAdminShell({ admin, children }: SuperAdminShellProps) {
  const pathname = usePathname() ?? "/super-admin";
  const initials = (admin.displayName ?? admin.email)
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase() || "SA";

  return (
    <div className="min-h-dvh bg-cream-100 text-ink">
      <div className="flex min-h-dvh">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-ink text-cream-100 sticky top-0 h-dvh">
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-lg bg-accent-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold">Bantu Niaga</p>
                <p className="text-[10px] font-semibold text-accent-300 uppercase tracking-wider">
                  Platform Admin
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-2">
            {GROUPS.map((group) => (
              <div key={group.caption} className="space-y-0.5">
                <p className="px-3 py-1 text-[10px] font-bold tracking-wider text-cream-400">
                  {group.caption}
                </p>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-ink-muted text-white font-bold"
                          : "text-cream-100 hover:bg-ink-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0",
                          active ? "text-accent-300" : "text-cream-400",
                        )}
                        strokeWidth={2}
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="px-3 pb-3 pt-2 space-y-2">
            <Link
              href="/home"
              className="flex items-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span>Back to tenant app</span>
            </Link>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-accent-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="leading-tight min-w-0">
                <p className="text-xs font-semibold truncate">
                  {admin.displayName ?? "Platform admin"}
                </p>
                <p className="text-[10px] text-cream-400 truncate">
                  {admin.email}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
