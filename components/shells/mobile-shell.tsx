"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  Boxes,
  Lock,
  Users,
  Menu,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import type { TierKey } from "@/lib/settings/plans";
import type { BusinessMembership } from "@/lib/auth/memberships";
import { CompanySwitcher } from "@/components/shells/CompanySwitcher";
import { hasPillar, type Pillar } from "@/lib/auth/entitlements";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  pillar?: Pillar;
}

const TABS: readonly Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/finance", label: "Money", icon: Wallet, pillar: "finance" },
  { href: "/operations", label: "Ops", icon: Boxes, pillar: "operations" },
  {
    href: "/marketing/customers",
    label: "People",
    icon: Users,
    pillar: "marketing",
  },
  { href: "/more", label: "More", icon: Menu },
];

export function MobileShell({
  tier,
  memberships,
  children,
}: {
  tier: TierKey;
  memberships: BusinessMembership[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHrAssistantRoute = pathname === "/hr/assistant";

  return (
    <div className="flex min-h-dvh flex-col bg-surface-light text-ink dark:bg-surface-dark dark:text-cream-100">
      <header className="sticky top-0 z-10 bg-brand-50/95 backdrop-blur border-b border-brand-100 dark:bg-brand-900/40 dark:border-hairline-dark">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.png"
              alt="Bantu Niaga"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0"
            />
            <p className="text-base font-bold leading-none tracking-tight">
              <span className="text-brand-700 dark:text-brand-200">Bantu</span>{" "}
              <span className="text-accent-500">Niaga</span>
            </p>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-md p-2 text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/40"
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
            </button>
          </form>
        </div>
        <div className="border-t border-brand-100 px-4 pb-3 pt-2 dark:border-hairline-dark">
          <CompanySwitcher memberships={memberships} compact />
        </div>
      </header>

      <main
        className={cn(
          "flex-1",
          isHrAssistantRoute
            ? "flex min-h-0 flex-col overflow-hidden pb-20"
            : "px-4 py-5 pb-24",
        )}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 bg-panel-light border-t border-hairline-light dark:bg-panel-dark dark:border-hairline-dark">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon, pillar }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            const locked = pillar ? !hasPillar(tier, pillar) : false;
            const lockedHref = locked
              ? `/settings/subscription?locked=${pillar}`
              : href;
            return (
              <li key={href} className="relative">
                <Link
                  href={lockedHref}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 min-h-tap-min text-xs",
                    active
                      ? "text-brand-700 dark:text-brand-200"
                      : locked
                        ? "text-ink-subtle dark:text-cream-500"
                        : "text-ink-muted dark:text-cream-400",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-500"
                    />
                  )}
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
                  <span className={cn(active && "font-semibold")}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
