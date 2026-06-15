"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Small badge that displays a segment's member count and optionally
 * re-fetches it on a debounce.
 *
 * Refetch policy:
 *   - On mount the badge shows `initialCount` immediately and does NOT
 *     fetch (list pages already supply server-rendered counts; firing
 *     a fan-out of detail GETs on render would be wasteful).
 *   - When the optional `refetchKey` changes the badge fires a single
 *     debounced GET against `/api/marketing/segments/[id]` — that
 *     endpoint recomputes + caches `member_count` server-side, so the
 *     same call refreshes the badge and the persisted count.
 *
 * Used on the detail page (parent bumps `refetchKey` after rule edits)
 * and as a stable place to plug live-updates if/when the list page
 * grows that feature.
 */

export interface SegmentMemberCountProps {
  segmentId: string;
  initialCount?: number;
  debounceMs?: number;
  refetchKey?: string | number;
  className?: string;
}

export function SegmentMemberCount({
  segmentId,
  initialCount,
  debounceMs = 250,
  refetchKey,
  className,
}: SegmentMemberCountProps) {
  const [count, setCount] = useState<number | null>(initialCount ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Skip the very first useEffect run so mount doesn't trigger a fetch
  // when only `initialCount` was provided.
  const skipFirstRef = useRef<boolean>(refetchKey === undefined);

  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/marketing/segments/${segmentId}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const body = (await res.json()) as {
          data?: { member_count?: number };
        };
        if (!controller.signal.aborted) {
          setCount(body.data?.member_count ?? 0);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [segmentId, debounceMs, refetchKey]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tabular-nums",
        error ? "text-status-danger" : "text-ink dark:text-cream-100",
        className,
      )}
      title={error ?? undefined}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} />
      ) : null}
      {error ? "—" : (count ?? 0).toLocaleString()}
    </span>
  );
}
