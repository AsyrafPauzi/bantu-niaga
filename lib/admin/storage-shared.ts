import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  File,
  FileSpreadsheet,
  FileText,
  Image,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import type { AdminFileCategory } from "@/lib/admin/schemas";

export const STORAGE_CATEGORY_LABELS: Record<AdminFileCategory, string> = {
  receipt: "Receipt",
  contract: "Contract",
  hr_doc: "HR document",
  compliance: "Compliance",
  finance: "Finance",
  operations: "Operations",
  other: "Other",
};

export const CATEGORY_STYLE: Record<
  AdminFileCategory,
  { icon: LucideIcon; chip: string; accent: string; card: string }
> = {
  receipt: {
    icon: Receipt,
    chip: "border-emerald-300/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    accent: "border-l-emerald-500",
    card: "from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-panel-dark",
  },
  contract: {
    icon: Briefcase,
    chip: "border-violet-300/70 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
    accent: "border-l-violet-500",
    card: "from-violet-50/80 to-white dark:from-violet-950/30 dark:to-panel-dark",
  },
  hr_doc: {
    icon: Users,
    chip: "border-sky-300/70 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    accent: "border-l-sky-500",
    card: "from-sky-50/80 to-white dark:from-sky-950/30 dark:to-panel-dark",
  },
  compliance: {
    icon: ShieldCheck,
    chip: "border-brand-300/70 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100",
    accent: "border-l-brand-500",
    card: "from-brand-50/80 to-white dark:from-brand-950/30 dark:to-panel-dark",
  },
  finance: {
    icon: FileSpreadsheet,
    chip: "border-amber-300/70 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    accent: "border-l-amber-500",
    card: "from-amber-50/80 to-white dark:from-amber-950/30 dark:to-panel-dark",
  },
  operations: {
    icon: Wrench,
    chip: "border-orange-300/70 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
    accent: "border-l-orange-500",
    card: "from-orange-50/80 to-white dark:from-orange-950/30 dark:to-panel-dark",
  },
  other: {
    icon: File,
    chip: "border-cream-400/80 bg-cream-100 text-ink-muted hover:bg-cream-200 dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-300",
    accent: "border-l-ink-subtle",
    card: "from-cream-50/80 to-white dark:from-hairline-dark/20 dark:to-panel-dark",
  },
};

export function fileTypeIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.endsWith("csv")
  ) {
    return FileSpreadsheet;
  }
  return File;
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function fmtRelUpload(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
