import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function OperationsBackLink() {
  return (
    <Link
      href="/operations"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      Operations overview
    </Link>
  );
}
