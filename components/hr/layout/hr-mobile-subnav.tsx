"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const HR_LINKS = [
  { href: "/hr", label: "Overview", exact: true },
  { href: "/hr/employees", label: "Employees", exact: false },
  { href: "/hr/leave", label: "Leave", exact: false },
  { href: "/hr/staff-portal", label: "Staff portal", exact: false },
  { href: "/hr/holidays", label: "Holidays", exact: false },
  { href: "/hr/appraisals", label: "Appraisals", exact: false },
  { href: "/hr/documents", label: "Documents", exact: false },
  { href: "/hr/assistant", label: "Assistant", exact: false },
] as const;

export function HrMobileSubnav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex gap-2 overflow-x-auto py-2 pb-1 lg:hidden",
        className,
      )}
    >
      {HR_LINKS.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand-700 text-white dark:bg-brand-500"
                : "border border-[#E5E0D8] bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
