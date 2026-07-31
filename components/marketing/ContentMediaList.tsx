import { cn } from "@/lib/utils/cn";
import { ContentMediaThumbs } from "./ContentMediaThumbs";
import type { ContentMediaRow } from "./types";

interface ContentMediaListProps {
  media: ContentMediaRow[];
  /** Compact rendering for the calendar chip; default = profile rendering. */
  variant?: "default" | "compact";
  className?: string;
}

export function ContentMediaList({
  media,
  variant = "default",
  className,
}: ContentMediaListProps) {
  if (!media || media.length === 0) {
    if (variant === "compact") return null;
    return (
      <p className={cn("text-xs text-ink-muted dark:text-cream-400", className)}>
        No media attached.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted dark:text-cream-400",
          className,
        )}
      >
        <span aria-hidden className="font-semibold">
          {media.length}
        </span>
        <span>file{media.length === 1 ? "" : "s"}</span>
      </span>
    );
  }

  return <ContentMediaThumbs media={media} className={className} />;
}
