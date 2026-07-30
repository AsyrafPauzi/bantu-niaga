import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/hr/me", label: "Overview", exact: true },
  { href: "/hr/me/leave/new", label: "Apply leave", exact: false },
  { href: "/hr/me/onboarding", label: "Onboarding", exact: false },
] as const;

interface MeMobileSubnavProps {
  pathname: string;
}

export function MeMobileSubnav({ pathname }: MeMobileSubnavProps) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand-500 text-white"
                : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
