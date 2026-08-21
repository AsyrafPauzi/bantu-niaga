"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Briefcase,
  Home,
  Laptop,
  Package,
  Palette,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  food: Utensils,
  drinks: Sparkles,
  snacks: ShoppingBag,
  catering: Utensils,
  beverages: Sparkles,
  dessert: Sparkles,
  desserts: Sparkles,
  grocery: ShoppingCart,
  retail: ShoppingBag,
  apparel: ShoppingBag,
  footwear: ShoppingBag,
  accessories: Tag,
  electronics: Smartphone,
  fashion: Palette,
  home: Home,
  beauty: Sparkles,
  digital: Laptop,
  general: Package,
  services: Briefcase,
  "hair & beauty": Sparkles,
  wellness: Sparkles,
  consulting: Briefcase,
  repair: Wrench,
  homestay: Home,
};

export function categoryEmoji(_category: string | null | undefined): string {
  return "";
}

export function CategoryIcon({
  category,
  className,
}: {
  category: string | null | undefined;
  className?: string;
}) {
  const key = category?.trim().toLowerCase() ?? "";
  const Icon = CATEGORY_ICON[key] ?? (key ? Tag : Package);
  return <Icon className={className} />;
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

  const iconSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";
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
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50/90 to-sky-50/80 text-ink-muted dark:from-emerald-950/40 dark:to-sky-950/30 dark:text-cream-400"
          title={name}
        >
          <CategoryIcon category={category} className={iconSize} />
        </div>
      )}
    </div>
  );
}
