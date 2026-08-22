import Link from "next/link";
import {
  CalendarPlus,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/hr/me", label: "Home", exact: true, icon: LayoutDashboard },
  {
    href: "/hr/me/attendance",
    label: "Clock",
    exact: false,
    icon: Clock,
  },
  {
    href: "/hr/me/leave/new",
    label: "Leave",
    exact: false,
    icon: CalendarPlus,
  },
  {
    href: "/hr/me/payslips",
    label: "Payslips",
    exact: false,
    icon: Wallet,
  },
  {
    href: "/hr/me/onboarding",
    label: "Onboard",
    exact: false,
    icon: ClipboardList,
  },
] as const;

interface MeMobileSubnavProps {
  pathname: string;
}

export function MeMobileSubnav({ pathname }: MeMobileSubnavProps) {
  return (
    <nav
      aria-label="Staff portal"
      className="sticky top-0 z-10 -mx-1 mb-1 bg-surface-light/95 px-1 py-1 backdrop-blur dark:bg-surface-dark/95 sm:static sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none dark:sm:bg-transparent"
    >
      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:px-3.5",
                active
                  ? "bg-[#0D9488] text-white shadow-sm"
                  : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-panel-dark dark:text-cream-400 dark:hover:bg-hairline-dark",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
