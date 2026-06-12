import { cn } from "@/lib/utils/cn";
import type { ContentChannel } from "./types";

/**
 * Platform / channel pill.
 *
 * The DB column is `channel` (plan §2.5); the UI shows it as the
 * platform name. Each platform gets a distinct tone so the calendar
 * chip is recognisable at a glance:
 *
 *   tiktok    — ink (sharpest contrast on cream)
 *   instagram — accent (warm orange — matches IG-ish hue without
 *               hard-coding brand colours)
 *   facebook  — brand-700 (the FB blue lane, mapped to our brand blue)
 *
 * Pure rendering, server-component safe.
 */

const CHANNEL_TONE: Record<ContentChannel, string> = {
  tiktok: "bg-ink text-white dark:bg-cream-100 dark:text-ink",
  instagram: "bg-accent-700 text-white",
  facebook: "bg-brand-700 text-white",
};

const CHANNEL_LABEL: Record<ContentChannel, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

interface ContentPlatformBadgeProps {
  channel: ContentChannel;
  size?: "sm" | "xs";
  className?: string;
}

export function ContentPlatformBadge({
  channel,
  size = "sm",
  className,
}: ContentPlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded font-medium uppercase tracking-wide",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        CHANNEL_TONE[channel],
        className,
      )}
      data-channel={channel}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}
