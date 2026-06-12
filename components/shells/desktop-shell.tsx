"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Banknote,
  Boxes,
  Megaphone,
  ShoppingCart,
  Users,
  Sparkles,
  Store,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

const SIDEBAR_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Pillars",
    items: [
      { href: "/admin", label: "Admin", icon: FileText },
      { href: "/finance", label: "Finance", icon: Banknote },
      { href: "/operations", label: "Operations", icon: Boxes },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/sales", label: "Sales", icon: ShoppingCart },
      { href: "/hr", label: "HR", icon: Users },
    ],
  },
  {
    label: "Cross-cutting",
    items: [
      { href: "/boardroom", label: "AI Boardroom", icon: Sparkles },
      { href: "/marketplace", label: "Marketplace", icon: Store },
      { href: "/settings/team", label: "Settings", icon: Settings },
    ],
  },
] as const;

export function DesktopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-cream-100 text-ink">
      <div className="flex">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-cream-300 bg-white sticky top-0 h-dvh">
          <div className="px-5 py-4 border-b border-cream-200">
            <Link href="/" className="flex items-center">
              <Image
                src="/brand/logo.png"
                alt="Bantu Niaga"
                width={180}
                height={48}
                priority
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-1 text-xs text-ink-muted">v0 · scaffold</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="px-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {group.label}
                </p>
                <ul>
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active =
                      href === "/"
                        ? pathname === "/"
                        : pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={cn(
                            "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                            active
                              ? "bg-brand-50 text-brand-700 font-medium border-l-2 border-brand-500"
                              : "text-ink-muted hover:bg-cream-100 hover:text-ink border-l-2 border-transparent",
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} />
                          <span>{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
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
