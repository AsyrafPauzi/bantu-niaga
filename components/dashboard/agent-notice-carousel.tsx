"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgentNoticeCard } from "@/components/dashboard/agent-notice-card";
import { cn } from "@/lib/utils/cn";

export interface AgentNoticeCarouselItem {
  agentSlug: string;
  title: string;
  body: string;
  assistantName: string;
  assistantHref: string;
}

interface AgentNoticeCarouselProps {
  notices: AgentNoticeCarouselItem[];
  className?: string;
}

export function AgentNoticeCarousel({
  notices,
  className,
}: AgentNoticeCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const { scrollLeft, scrollWidth, clientWidth } = track;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);

    const slides = Array.from(
      track.querySelectorAll<HTMLElement>("[data-notice-slide]"),
    );
    if (slides.length === 0) return;

    const center = scrollLeft + clientWidth / 2;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(center - slideCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    }
    setActiveIndex(nearest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    syncScrollState();
    track.addEventListener("scroll", syncScrollState, { passive: true });
    window.addEventListener("resize", syncScrollState);

    return () => {
      track.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("resize", syncScrollState);
    };
  }, [notices.length, syncScrollState]);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;

    const slide = track.querySelector<HTMLElement>(
      `[data-notice-slide="${index}"]`,
    );
    if (!slide) return;

    slide.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }, []);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    scrollToIndex(Math.min(notices.length - 1, Math.max(0, activeIndex + direction)));
  }, [activeIndex, notices.length, scrollToIndex]);

  if (notices.length === 0) return null;

  const showControls = notices.length > 1;

  return (
    <section className={cn("space-y-2", className)} aria-label="AI daily notices">
      <div className="relative">
        {showControls ? (
          <>
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canScrollLeft}
              aria-label="Previous notice"
              className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-cream-300 bg-white p-1.5 text-ink shadow-card transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:inline-flex dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              aria-label="Next notice"
              className="absolute right-0 top-1/2 z-10 hidden translate-x-1/2 -translate-y-1/2 rounded-full border border-cream-300 bg-white p-1.5 text-ink shadow-card transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:inline-flex dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
          </>
        ) : null}

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {notices.map((notice, index) => (
            <div
              key={notice.agentSlug}
              data-notice-slide={index}
              className="w-full min-w-full shrink-0 snap-start snap-always"
            >
              <AgentNoticeCard
                title={notice.title}
                body={notice.body}
                assistantName={notice.assistantName}
                assistantHref={notice.assistantHref}
              />
            </div>
          ))}
        </div>
      </div>

      {showControls ? (
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {notices.map((notice, index) => (
              <button
                key={notice.agentSlug}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`Go to notice ${index + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === activeIndex
                    ? "w-5 bg-brand-500"
                    : "w-1.5 bg-cream-300 hover:bg-brand-300 dark:bg-hairline-dark dark:hover:bg-brand-700",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-ink-muted dark:text-cream-400 sm:hidden">
            Swipe left or right
          </p>
        </div>
      ) : null}
    </section>
  );
}
