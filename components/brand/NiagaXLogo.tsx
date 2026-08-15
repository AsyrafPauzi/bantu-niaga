import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function NiagaXLogo({
  compact = false,
  tone = "default",
  className,
}: {
  compact?: boolean;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const niaga = tone === "inverse" ? "text-white" : "text-brand-600";
  const x = tone === "inverse" ? "text-accent-300" : "text-accent-500";
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display text-[18px] font-bold",
        className,
      )}
    >
      <span className={cn("tracking-tight", niaga)}>Niaga</span>
      <span className={x}>X</span>
      {compact ? <span className="sr-only"> home</span> : null}
    </span>
  );
}

export function NiagaXLogoLink({
  href = "/",
  onClick,
  ariaLabel = "NiagaX home",
  className,
}: {
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("text-ink", className)}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <NiagaXLogo />
    </Link>
  );
}
