"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
}

interface AdminStorageThumbnailProps {
  fileId: string;
  mimeType: string;
  fileName: string;
  className?: string;
}

export function AdminStorageThumbnail({
  fileId,
  mimeType,
  fileName,
  className,
}: AdminStorageThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    if (!isImage && !isPdf) return;
    let cancelled = false;

    void fetch(`/api/admin/storage/${fileId}/download?inline=1`)
      .then((r) => r.json())
      .then((json: ApiEnvelope<{ download_url: string }>) => {
        if (!cancelled && json.ok && json.data?.download_url) {
          setUrl(json.data.download_url);
        } else if (!cancelled) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, isImage, isPdf]);

  if (isImage && url && !failed) {
    return (
       
      <img
        src={url}
        alt={fileName}
        className={cn(
          "h-full w-full object-cover",
          className,
        )}
      />
    );
  }

  if (isPdf && url && !failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 bg-red-50/80 text-red-800 hover:bg-red-100/80 dark:bg-red-950/30 dark:text-red-200",
          className,
        )}
        title="Open PDF preview"
      >
        <FileText className="h-6 w-6" strokeWidth={1.5} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          PDF
        </span>
      </a>
    );
  }

  if ((isImage || isPdf) && !url && !failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-cream-100/80 dark:bg-hairline-dark/40",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
      </div>
    );
  }

  return null;
}
