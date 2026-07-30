/**
 * Client-safe compliance constants and UI helpers.
 */

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileText,
  Flame,
  Home,
  MapPin,
  Receipt,
  Shield,
  ShieldCheck,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { AdminComplianceCategory } from "@/lib/admin/task-compliance-schemas";

export const DEFAULT_COMPLIANCE_REMIND_DAYS = [30, 14, 3] as const;
export const COMPLIANCE_REMIND_DAY_OPTIONS = [30, 14, 7, 3, 1] as const;

export const COMPLIANCE_PRESETS: Array<{
  title: string;
  category: AdminComplianceCategory;
  authority: string;
}> = [
  {
    title: "SSM Business Registration Renewal",
    category: "ssm",
    authority: "SSM",
  },
  {
    title: "DBKL Signboard Licence (Papan Tanda)",
    category: "dbkl",
    authority: "DBKL",
  },
  {
    title: "Halal Certification Renewal",
    category: "halal",
    authority: "JAKIM",
  },
  {
    title: "Premises / Fire Insurance Policy",
    category: "insurance",
    authority: "Insurer",
  },
  {
    title: "Food Handler Training (Typhoid / KKM)",
    category: "food_handler",
    authority: "KKM",
  },
  {
    title: "Tenancy Agreement Renewal",
    category: "tenancy",
    authority: "Landlord",
  },
  {
    title: "SST Registration / Return (LHDN)",
    category: "tax",
    authority: "LHDN",
  },
  {
    title: "BOMBA Fire Certificate (FC)",
    category: "bomba",
    authority: "BOMBA",
  },
  {
    title: "Local Council Business Licence (MBSA / MBPJ)",
    category: "local_council",
    authority: "Local council",
  },
];

export const CATEGORY_STYLE: Record<
  AdminComplianceCategory,
  { icon: LucideIcon; chip: string; accent: string }
> = {
  ssm: {
    icon: Building2,
    chip: "border-brand-300/70 bg-brand-50 text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/50 dark:text-brand-100",
    accent: "border-l-brand-500",
  },
  dbkl: {
    icon: Shield,
    chip: "border-violet-300/70 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
    accent: "border-l-violet-500",
  },
  halal: {
    icon: Star,
    chip: "border-emerald-300/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    accent: "border-l-emerald-500",
  },
  food_handler: {
    icon: UtensilsCrossed,
    chip: "border-orange-300/70 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100",
    accent: "border-l-orange-500",
  },
  insurance: {
    icon: ShieldCheck,
    chip: "border-sky-300/70 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    accent: "border-l-sky-500",
  },
  tenancy: {
    icon: Home,
    chip: "border-amber-300/70 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    accent: "border-l-amber-500",
  },
  tax: {
    icon: Receipt,
    chip: "border-rose-300/70 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
    accent: "border-l-rose-500",
  },
  bomba: {
    icon: Flame,
    chip: "border-red-300/70 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    accent: "border-l-red-500",
  },
  local_council: {
    icon: MapPin,
    chip: "border-teal-300/70 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100",
    accent: "border-l-teal-500",
  },
  other: {
    icon: FileText,
    chip: "border-cream-400/80 bg-cream-100 text-ink-muted hover:bg-cream-200 dark:border-hairline-dark dark:bg-hairline-dark/40 dark:text-cream-300",
    accent: "border-l-ink-subtle",
  },
};

export type ComplianceFilter =
  | "all"
  | "overdue"
  | "due_month"
  | AdminComplianceCategory;

export const AMIR_RENEWALS_PROMPT =
  "What licence renewals should I focus on this week? List them by urgency with suggested next steps.";

export const AMIR_MISSING_DOCS_PROMPT =
  "Which licences or permits are missing an uploaded certificate? What should I upload first?";
