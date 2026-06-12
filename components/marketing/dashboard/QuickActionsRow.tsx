import Link from "next/link";
import {
  CalendarPlus,
  Download,
  RefreshCw,
  Upload,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface QuickActionsRowProps {
  className?: string;
}

const ACTIONS = [
  {
    label: "Add customer",
    href: "/marketing/customers/new",
    icon: UserPlus,
    tone: "primary" as const,
  },
  {
    label: "Import CSV",
    href: "/marketing/customers/import",
    icon: Upload,
    tone: "accent" as const,
  },
  {
    label: "Plan content",
    href: "/marketing/content/new",
    icon: CalendarPlus,
    tone: "soft-brand" as const,
  },
  {
    label: "Export book",
    href: "/api/marketing/customers/csv-export",
    icon: Download,
    tone: "soft-cream" as const,
  },
  {
    label: "Refresh tags",
    href: "/marketing/customers",
    icon: RefreshCw,
    tone: "soft-cream" as const,
  },
];

const TONE_CLASSES: Record<string, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 border-brand-500",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 border-accent-500",
  "soft-brand":
    "bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200 dark:border-brand-900/60 dark:hover:bg-brand-900/50",
  "soft-cream":
    "bg-cream-100 text-ink border-cream-300 hover:bg-cream-200 dark:bg-panel-dark dark:text-cream-100 dark:border-hairline-dark dark:hover:bg-hairline-dark/60",
};

export function QuickActionsRow({ className }: QuickActionsRowProps) {
  return (
    <div
      className={cn(
        "flex w-full snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0",
        className,
      )}
    >
      {ACTIONS.map(({ label, href, icon: Icon, tone }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-card transition-colors",
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
