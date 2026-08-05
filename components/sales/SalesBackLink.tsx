import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SalesBackLinkProps {
  href?: string;
  label?: string;
}

export function SalesBackLink({
  href = "/sales",
  label = "Sales overview",
}: SalesBackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors dark:text-cream-400",
        "hover:text-[#2563EB] dark:hover:text-blue-300",
      )}
    >
      <ArrowLeft className="h-4 w-4 text-[#2563EB] dark:text-blue-400" strokeWidth={2} />
      {label}
    </Link>
  );
}
