/**
 * Bantu Niaga — chart-ready palette for the Marketing dashboard.
 *
 * Recharts components take SVG fill / stroke as plain strings, so we
 * keep one tiny module that re-exports the relevant tailwind tokens as
 * hex strings (mirrored from `tailwind.config.ts`). Charts import from
 * here instead of pulling the whole tailwind config in.
 *
 * If a token in tailwind.config.ts changes, update it here too.
 */

export const DASHBOARD_COLORS = {
  brand: {
    50: "#EEF3FE",
    100: "#D5E2FB",
    200: "#B0C5F6",
    300: "#809FEC",
    400: "#4D78E1",
    500: "#1D4ED8",
    600: "#1740B1",
    700: "#11328A",
    800: "#0C2363",
    900: "#07153D",
  },
  accent: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316",
    600: "#EA580C",
    700: "#C2410C",
  },
  cream: {
    50: "#FFFEFB",
    100: "#FAF7F2",
    200: "#F2EDE3",
    300: "#E5E0D8",
    400: "#C9C2B5",
  },
  ink: {
    DEFAULT: "#1A1A1A",
    muted: "#6B6B6B",
    subtle: "#9A9A9A",
  },
  status: {
    success: "#0F7B4A",
    warning: "#D89614",
    danger: "#C0392B",
    info: "#2D6A8A",
  },
  hairline: {
    light: "#E5E0D8",
    dark: "#262B33",
  },
  panel: {
    light: "#FFFFFF",
    dark: "#161A21",
  },
} as const;

/**
 * Per-segment chart colors for the auto-tag donut + tag chips.
 *
 * Mirrors the priority order used in `<TagBadge>` (vip = orange, repeat
 * = brand, new = info, dormant = neutral, at-risk = warning).
 */
export const SEGMENT_COLORS = {
  vip: DASHBOARD_COLORS.accent[500],
  repeat: DASHBOARD_COLORS.brand[500],
  new: DASHBOARD_COLORS.status.success,
  dormant: DASHBOARD_COLORS.cream[400],
  at_risk: DASHBOARD_COLORS.status.warning,
} as const;

export type SegmentKey = keyof typeof SEGMENT_COLORS;
