"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍜",
  drinks: "🥤",
  snacks: "🍿",
  catering: "🍱",
  beverages: "🧃",
  dessert: "🍰",
  desserts: "🍰",
  grocery: "🛒",
  retail: "🛍️",
  apparel: "👕",
  footwear: "👟",
  accessories: "👜",
  electronics: "📱",
  fashion: "👗",
  home: "🏠",
  beauty: "💄",
  digital: "💾",
  general: "📦",
  services: "🛎️",
  "hair & beauty": "💇",
  wellness: "🧘",
  consulting: "💼",
  repair: "🔧",
  homestay: "🏠",
};

export function categoryEmoji(category: string | null | undefined): string {
  if (!category?.trim()) return "📦";
  return CATEGORY_EMOJI[category.trim().toLowerCase()] ?? "🏷️";
}

interface OperationsProductThumbProps {
  imageFileId: string | null;
  category: string | null;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

export function OperationsProductThumb({
  imageFileId,
  category,
  name,
  size = "md",
  className,
}: OperationsProductThumbProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageFileId) {
      setSrc(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/storage/${imageFileId}/download`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { download_url: string } }) => {
        if (!cancelled && json.ok && json.data?.download_url) {
          setSrc(json.data.download_url);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [imageFileId]);

  const emoji = categoryEmoji(category);
  const sizeClass = size === "sm" ? "h-11 w-11 rounded-lg" : "h-14 w-14 rounded-xl";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-cream-200 bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark/50",
        sizeClass,
        className,
      )}
      aria-hidden={!imageFileId || failed}
    >
      {src && !failed ? (
        <Image src={src} alt="" fill className="object-cover" sizes="96px" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50/90 to-sky-50/80 dark:from-emerald-950/40 dark:to-sky-950/30"
          title={name}
        >
          <span className={size === "sm" ? "text-lg" : "text-2xl"}>{emoji}</span>
        </div>
      )}
    </div>
  );
}
