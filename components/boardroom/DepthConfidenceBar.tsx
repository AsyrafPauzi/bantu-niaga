"use client";

import { DEPTH_CONFIDENCE_THRESHOLD } from "@/lib/ai/boardroom-output-schema";

export function DepthConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const target = Math.round(DEPTH_CONFIDENCE_THRESHOLD * 100);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-white/60">Room confidence</span>
        <span className="font-semibold text-white/90">
          {pct}% / {target}% target
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
