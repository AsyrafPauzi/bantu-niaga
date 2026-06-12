"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  Boxes,
  Users,
  Menu,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/sign-in/actions";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/finance", label: "Money", icon: Wallet },
  { href: "/operations", label: "Ops", icon: Boxes },
  { href: "/marketing/customers", label: "People", icon: Users },
  { href: "/more", label: "More", icon: Menu },
] as const;

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface-light text-ink flex flex-col dark:bg-surface-dark dark:text-cream-100">
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
      </header>

      <main className="flex-1 px-4 py-5 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 bg-panel-light border-t border-hairline-light dark:bg-panel-dark dark:border-hairline-dark">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="relative">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 min-h-tap-min text-xs",
                    active
                      ? "text-brand-700 dark:text-brand-200"
                      : "text-ink-muted dark:text-cream-400",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-500"
                    />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
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
