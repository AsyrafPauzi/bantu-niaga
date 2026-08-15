/**
 * NiagaX — chart-ready palette for the Marketing dashboard.
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
    50: "#ECFEFF",
    100: "#CFFAFE",
    200: "#A5F3FC",
    300: "#67E8F9",
    400: "#22D3EE",
    500: "#0E7490",
    600: "#0E7490",
    700: "#155E75",
    800: "#164E63",
    900: "#083344",
  },
  accent: {
    50: "#F0FDFA",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#0F766E",
    600: "#0D9488",
    700: "#115E59",
  },
  cream: {
    50: "#F8FAFC",
    100: "#EEF2F6",
    200: "#E4EAF1",
    300: "#D6DEE8",
    400: "#94A3B8",
  },
  ink: {
    DEFAULT: "#0B1220",
    muted: "#5B6775",
    subtle: "#7A8794",
  },
  status: {
    success: "#0F7B4A",
    warning: "#D89614",
    danger: "#C0392B",
    info: "#2D6A8A",
  },
  hairline: {
    light: "#D6DEE8",
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
 * Mirrors the priority order used in `<TagBadge>` (vip = accent, repeat
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
