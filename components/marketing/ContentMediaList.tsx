import { cn } from "@/lib/utils/cn";
import type { ContentMediaRow } from "./types";

/**
 * Thumbnail strip for attached media on a content_plan entry.
 *
 * v1 limitation (D6): Admin Storage has not shipped its `files` table
 * + signed-URL endpoint yet, so we cannot render real thumbnails. Each
 * media row is rendered as a placeholder tile labelled with the
 * `file_id` so operators can audit the link. Once D6 lands, swap the
 * placeholder for an `<img src={signedUrl} />` without changing the
 * component's external API.
 */

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
        <span aria-hidden>📎</span>
        <span>{media.length}</span>
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {media.map((m) => (
        <div
          key={m.file_id}
          className={cn(
            "flex h-20 w-20 flex-col items-center justify-center rounded-md",
            "border border-dashed border-cream-300 bg-cream-100 px-1 text-center",
            "dark:border-hairline-dark dark:bg-panel-dark/40",
          )}
          title={`file_id: ${m.file_id}`}
          data-file-id={m.file_id}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted dark:text-cream-400">
            Media
          </span>
          <span className="mt-1 break-all text-[9px] leading-tight text-ink-muted dark:text-cream-400">
            {m.file_id.slice(0, 8)}…
          </span>
        </div>
      ))}
    </div>
  );
}
