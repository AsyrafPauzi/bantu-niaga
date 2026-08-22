import type { Pillar } from "@/lib/permissions";

/** App page canvas — cool paper that blends with every pillar tint (#EEF2F6). */
export const APP_CANVAS_CLASS = "bg-surface-light";

/** Canonical pillar brand colors (hex) */
export const PILLAR_COLORS = {
  admin: { primary: "#4F46E5", dark: "#4338CA" },
  finance: { primary: "#059669", dark: "#047857" },
  operations: { primary: "#EA580C", dark: "#C2410C" },
  marketing: { primary: "#9333EA", dark: "#7E22CE" },
  sales: { primary: "#2563EB", dark: "#1D4ED8" },
  hr: { primary: "#0D9488", dark: "#0F766E" },
} as const satisfies Record<Pillar, { primary: string; dark: string }>;

export interface PillarClasses {
  btnPrimary: string;
  btnSecondary: string;
  text: string;
  textMuted: string;
  link: string;
  avatar: string;
  heroBorder: string;
  heroBg: string;
  iconBox: string;
  chip: string;
  input: string;
  label: string;
  sectionTitle: string;
  sectionHint: string;
  eyebrow: string;
  accentGradient: string;
  quickActionHover: string;
  sectionPanel: string;
  sectionPanelItem: string;
}

/** Tailwind class tokens per pillar — explicit strings for JIT. */
export const pillarClasses: Record<Pillar, PillarClasses> = {
  admin: {
    btnPrimary:
      "bg-[#4F46E5] text-white hover:bg-[#4338CA] active:scale-[0.98]",
    btnSecondary:
      "border border-indigo-300/80 bg-white text-[#4338CA] hover:bg-indigo-50 dark:border-indigo-800 dark:bg-panel-dark dark:text-indigo-200 dark:hover:bg-indigo-950/40",
    text: "text-[#4F46E5] dark:text-indigo-400",
    textMuted: "text-indigo-700/80 dark:text-indigo-300/80",
    link: "font-semibold text-[#4F46E5] hover:underline dark:text-indigo-400",
    avatar:
      "bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/50 dark:text-indigo-300",
    heroBorder: "border-indigo-200/80 dark:border-indigo-900/50",
    heroBg:
      "bg-gradient-to-br from-indigo-50/90 via-white to-cream-100 dark:from-indigo-950/30 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-indigo-50 text-[#4F46E5] dark:bg-indigo-950/50 dark:text-indigo-300",
    chip: "bg-indigo-50 text-[#4338CA] dark:bg-indigo-950/40 dark:text-indigo-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-indigo-700 dark:text-indigo-300",
    accentGradient: "from-indigo-500 to-indigo-600",
    quickActionHover: "hover:border-indigo-200 dark:hover:border-indigo-800",
    sectionPanel:
      "rounded-xl border border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20",
    sectionPanelItem:
      "border border-indigo-200/60 bg-white/80 dark:border-indigo-900/50 dark:bg-panel-dark/80",
  },
  finance: {
    btnPrimary:
      "bg-[#059669] text-white hover:bg-[#047857] active:scale-[0.98]",
    btnSecondary:
      "border border-emerald-300/80 bg-white text-[#047857] hover:bg-emerald-50 dark:border-emerald-800 dark:bg-panel-dark dark:text-emerald-200 dark:hover:bg-emerald-950/40",
    text: "text-[#059669] dark:text-emerald-400",
    textMuted: "text-emerald-700/80 dark:text-emerald-300/80",
    link: "font-semibold text-[#059669] hover:underline dark:text-emerald-400",
    avatar:
      "bg-emerald-50 text-[#059669] dark:bg-emerald-950/50 dark:text-emerald-300",
    heroBorder: "border-emerald-200/80 dark:border-emerald-900/50",
    heroBg:
      "bg-gradient-to-br from-emerald-50/90 via-white to-cream-100 dark:from-emerald-950/30 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-emerald-50 text-[#059669] dark:bg-emerald-950/50 dark:text-emerald-300",
    chip: "bg-emerald-50 text-[#047857] dark:bg-emerald-950/40 dark:text-emerald-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    accentGradient: "from-emerald-500 to-emerald-600",
    quickActionHover: "hover:border-emerald-200 dark:hover:border-emerald-800",
    sectionPanel:
      "rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    sectionPanelItem:
      "border border-emerald-200/60 bg-white/80 dark:border-emerald-900/50 dark:bg-panel-dark/80",
  },
  operations: {
    btnPrimary:
      "bg-[#EA580C] text-white hover:bg-[#C2410C] active:scale-[0.98]",
    btnSecondary:
      "border border-orange-300/80 bg-white text-[#C2410C] hover:bg-orange-50 dark:border-orange-800 dark:bg-panel-dark dark:text-orange-200 dark:hover:bg-orange-950/40",
    text: "text-[#EA580C] dark:text-orange-400",
    textMuted: "text-orange-700/80 dark:text-orange-300/80",
    link: "font-semibold text-[#EA580C] hover:underline dark:text-orange-400",
    avatar:
      "bg-orange-50 text-[#EA580C] dark:bg-orange-950/50 dark:text-orange-300",
    heroBorder: "border-orange-200/80 dark:border-orange-900/50",
    heroBg:
      "bg-gradient-to-br from-orange-50/90 via-white to-cream-100 dark:from-orange-950/30 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-orange-50 text-[#EA580C] dark:bg-orange-950/50 dark:text-orange-300",
    chip: "bg-orange-50 text-[#C2410C] dark:bg-orange-950/40 dark:text-orange-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#EA580C] focus:ring-2 focus:ring-[#EA580C]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-orange-700 dark:text-orange-300",
    accentGradient: "from-orange-500 to-orange-600",
    quickActionHover: "hover:border-orange-200 dark:hover:border-orange-800",
    sectionPanel:
      "rounded-xl border border-orange-200/80 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/20",
    sectionPanelItem:
      "border border-orange-200/60 bg-white/80 dark:border-orange-900/50 dark:bg-panel-dark/80",
  },
  marketing: {
    btnPrimary:
      "bg-[#9333EA] text-white hover:bg-[#7E22CE] active:scale-[0.98]",
    btnSecondary:
      "border border-purple-300/80 bg-white text-[#7E22CE] hover:bg-purple-50 dark:border-purple-800 dark:bg-panel-dark dark:text-purple-200 dark:hover:bg-purple-950/40",
    text: "text-[#9333EA] dark:text-purple-400",
    textMuted: "text-purple-700/80 dark:text-purple-300/80",
    link: "font-semibold text-[#9333EA] hover:underline dark:text-purple-400",
    avatar:
      "bg-purple-50 text-[#9333EA] dark:bg-purple-950/50 dark:text-purple-300",
    heroBorder: "border-purple-200/80 dark:border-purple-900/40",
    heroBg:
      "bg-gradient-to-br from-purple-50/90 via-white to-cream-100 dark:from-purple-950/15 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-purple-50 text-[#9333EA] dark:bg-purple-950/50 dark:text-purple-300",
    chip: "bg-purple-50 text-[#7E22CE] dark:bg-purple-950/40 dark:text-purple-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#9333EA] focus:ring-2 focus:ring-[#9333EA]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-purple-700 dark:text-purple-300",
    accentGradient: "from-purple-500 to-purple-600",
    quickActionHover: "hover:border-purple-200 dark:hover:border-purple-800",
    sectionPanel:
      "rounded-xl border border-purple-200/80 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/20",
    sectionPanelItem:
      "border border-purple-200/60 bg-white/80 dark:border-purple-900/50 dark:bg-panel-dark/80",
  },
  sales: {
    btnPrimary:
      "bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:scale-[0.98]",
    btnSecondary:
      "border border-blue-300/80 bg-white text-[#1D4ED8] hover:bg-blue-50 dark:border-blue-800 dark:bg-panel-dark dark:text-blue-200 dark:hover:bg-blue-950/40",
    text: "text-[#2563EB] dark:text-blue-400",
    textMuted: "text-blue-700/80 dark:text-blue-300/80",
    link: "font-semibold text-[#2563EB] hover:underline dark:text-blue-400",
    avatar:
      "bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300",
    heroBorder: "border-blue-200/80 dark:border-blue-900/50",
    heroBg:
      "bg-gradient-to-br from-blue-50/90 via-white to-cream-100 dark:from-blue-950/30 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300",
    chip: "bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/40 dark:text-blue-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-blue-700 dark:text-blue-300",
    accentGradient: "from-blue-500 to-blue-600",
    quickActionHover: "hover:border-blue-200 dark:hover:border-blue-800",
    sectionPanel:
      "rounded-xl border border-blue-200/80 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20",
    sectionPanelItem:
      "border border-blue-200/60 bg-white/80 dark:border-blue-900/50 dark:bg-panel-dark/80",
  },
  hr: {
    btnPrimary:
      "bg-[#0D9488] text-white hover:bg-[#0F766E] active:scale-[0.98]",
    btnSecondary:
      "border border-teal-300/80 bg-white text-[#0F766E] hover:bg-teal-50 dark:border-teal-800 dark:bg-panel-dark dark:text-teal-200 dark:hover:bg-teal-950/40",
    text: "text-[#0D9488] dark:text-teal-400",
    textMuted: "text-teal-700/80 dark:text-teal-300/80",
    link: "font-semibold text-[#0D9488] hover:underline dark:text-teal-400",
    avatar:
      "bg-teal-50 text-[#0D9488] dark:bg-teal-950/50 dark:text-teal-300",
    heroBorder: "border-teal-200/80 dark:border-teal-900/50",
    heroBg:
      "bg-gradient-to-br from-teal-50/90 via-white to-cream-100 dark:from-teal-950/30 dark:via-panel-dark dark:to-surface-dark",
    iconBox:
      "bg-teal-50 text-[#0D9488] dark:bg-teal-950/50 dark:text-teal-300",
    chip: "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300",
    input:
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/25 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
    label:
      "block space-y-1 text-xs font-semibold text-ink-muted dark:text-cream-400",
    sectionTitle: "text-sm font-semibold text-ink dark:text-cream-100",
    sectionHint: "text-xs text-ink-muted dark:text-cream-400",
    eyebrow: "text-teal-700 dark:text-teal-300",
    accentGradient: "from-teal-500 to-teal-600",
    quickActionHover: "hover:border-teal-200 dark:hover:border-teal-800",
    sectionPanel:
      "rounded-xl border border-teal-200/80 bg-teal-50/40 dark:border-teal-900/40 dark:bg-teal-950/20",
    sectionPanelItem:
      "border border-teal-200/60 bg-white/80 dark:border-teal-900/50 dark:bg-panel-dark/80",
  },
};

export function getPillarClasses(pillar: Pillar): PillarClasses {
  return pillarClasses[pillar];
}

/** Map display module labels to pillar ids. */
export const MODULE_TO_PILLAR: Record<string, Pillar> = {
  Admin: "admin",
  Finance: "finance",
  Operations: "operations",
  Marketing: "marketing",
  Sales: "sales",
  HR: "hr",
  "People & Leave": "hr",
};

export function pillarFromModule(module: string): Pillar {
  return MODULE_TO_PILLAR[module] ?? "admin";
}

/** Shared page wrapper classes — max width, horizontal rhythm, vertical padding. */
export const PILLAR_PAGE_SHELL =
  "mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-10 lg:py-6";
