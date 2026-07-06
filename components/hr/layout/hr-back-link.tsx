import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface HrBackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function HrBackLink({ href, label, className }: HrBackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-200 dark:hover:text-brand-100",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {label}
    </Link>
  );
}
