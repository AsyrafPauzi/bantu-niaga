import type { Config } from "tailwindcss";

/**
 * Bantu Niaga — design tokens.
 *
 * Direction: SME-friendly, not corporate. No gradients.
 * Palette is logo-derived: a confident royal `brand` blue (sampled from the
 * "Bantu" wordmark and the bag/"B" lockup) paired with a vibrant `accent`
 * orange (sampled from the "Niaga" wordmark, awning stripes, and chart
 * bars). Cream background and warm ink neutrals are retained so the UI
 * still reads warm and SME-friendly rather than cold-corporate.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Royal blue scale anchored on `brand-500: #1D4ED8` (the "Bantu"
        // wordmark / bag-and-B blue from the logo).
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
        // Warm orange scale anchored on `accent-500: #F97316` (the "Niaga"
        // wordmark, awning stripes, chart bars, and arrowhead).
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
          // Intentionally kept as a standalone success green (the old
          // `brand-500`) rather than reusing the new brand blue: confirmation
          // states must stay semantically distinct from "primary action", and
          // green still reads universally as "good / saved / paid".
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
        card: "0 1px 2px 0 rgba(26, 26, 26, 0.04), 0 1px 3px 0 rgba(26, 26, 26, 0.06)",
        elevated:
          "0 4px 6px -1px rgba(26, 26, 26, 0.06), 0 2px 4px -2px rgba(26, 26, 26, 0.04)",
      },
      spacing: {
        "tap-min": "44px",
      },
    },
  },
  plugins: [],
};

export default config;
