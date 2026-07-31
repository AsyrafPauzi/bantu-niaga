"use client";

import { useEffect, useState } from "react";
import { Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ContentMediaRow } from "./types";

interface ContentMediaThumbsProps {
  media: ContentMediaRow[];
  className?: string;
}

function MediaTile({ fileId }: { fileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/marketing/media/${fileId}/download`);
        if (!res.ok) {
          if (!cancelled) setFailed(true);
          return;
        }
        const body = (await res.json()) as {
          ok?: boolean;
          data?: { download_url?: string; mime_type?: string };
        };
        if (!body.ok || !body.data?.download_url) {
          if (!cancelled) setFailed(true);
          return;
        }
        if (!cancelled) {
          setUrl(body.data.download_url);
          setIsVideo(
            (body.data.mime_type ?? "").toLowerCase().startsWith("video/"),
          );
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (failed || !url) {
    return (
      <div
        className={cn(
          "flex h-20 w-20 flex-col items-center justify-center rounded-md",
          "border border-dashed border-cream-300 bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark/40",
        )}
        title={fileId}
      >
        <ImageIcon className="h-5 w-5 text-ink-muted dark:text-cream-400" />
        <span className="mt-1 text-[9px] text-ink-muted dark:text-cream-400">
          {fileId.slice(0, 6)}…
        </span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div
        className="relative h-20 w-20 overflow-hidden rounded-md border border-cream-200 bg-ink dark:border-hairline-dark"
        title={fileId}
      >
        <video
          src={url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <span className="absolute bottom-1 right-1 rounded bg-ink/70 p-0.5 text-white">
          <Film className="h-3 w-3" />
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="h-20 w-20 rounded-md border border-cream-200 object-cover dark:border-hairline-dark"
      title={fileId}
    />
  );
}

export function ContentMediaThumbs({ media, className }: ContentMediaThumbsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {media.map((m) => (
        <MediaTile key={m.file_id} fileId={m.file_id} />
      ))}
    </div>
  );
}
