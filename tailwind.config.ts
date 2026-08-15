import type { Config } from "tailwindcss";

/**
 * NiagaX — design tokens aligned with lp-niagax.
 *
 * Cool cyan brand + teal conversion accent on slate paper.
 * No gradients. cream-* aliases map to the cool paper system.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // Class-based dark mode: a `dark` class on <html> activates `dark:` variants.
  // The class is toggled by `ThemeProvider` + a no-flash inline script in
  // `app/layout.tsx`. See `lib/theme/` for the resolver and storage key.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
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
        surface: {
          light: "#EEF2F6",
          dark: "#0F1115",
        },
        panel: {
          light: "#FFFFFF",
          dark: "#161A21",
        },
        hairline: {
          light: "#D6DEE8",
          dark: "#262B33",
        },
        status: {
          success: "#0F7B4A",
          warning: "#D89614",
          danger: "#C0392B",
          info: "#2D6A8A",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Funnel Sans",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(11, 18, 32, 0.04), 0 1px 3px 0 rgba(11, 18, 32, 0.06)",
        elevated:
          "0 4px 6px -1px rgba(11, 18, 32, 0.06), 0 2px 4px -2px rgba(11, 18, 32, 0.04)",
      },
      spacing: {
        "tap-min": "44px",
      },
    },
  },
  plugins: [],
};

export default config;
