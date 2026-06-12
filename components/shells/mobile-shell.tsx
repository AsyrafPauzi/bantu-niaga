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
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

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
    <div className="min-h-dvh bg-cream-100 text-ink flex flex-col">
      <header className="sticky top-0 z-10 bg-cream-100/90 backdrop-blur border-b border-cream-300">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/logo.png"
              alt="Bantu Niaga"
              width={144}
              height={36}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <span className="text-xs text-ink-muted">v0 · scaffold</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 bg-white border-t border-cream-300">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 min-h-tap-min text-xs",
                    active ? "text-brand-500" : "text-ink-muted",
                  )}
                >
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
