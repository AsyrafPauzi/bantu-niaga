import { cn } from "@/lib/utils/cn";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  // Primary keeps the logo blue in both modes; disabled state in dark mode
  // gets a hairline-tinted fill so it's still legibly "muted but visible".
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400",
  secondary:
    "bg-cream-200 text-ink hover:bg-cream-300 active:bg-cream-400 border border-cream-300 dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark dark:active:bg-hairline-dark dark:border-hairline-dark",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700",
  ghost:
    "bg-transparent text-ink hover:bg-cream-200 active:bg-cream-300 dark:text-cream-100 dark:hover:bg-hairline-dark/60 dark:active:bg-hairline-dark",
  danger:
    "bg-status-danger text-white hover:opacity-90 active:opacity-80",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-base rounded-lg min-h-tap-min",
  lg: "h-14 px-6 text-base rounded-lg min-h-tap-min",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100 dark:focus-visible:ring-offset-surface-dark",
          "disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
