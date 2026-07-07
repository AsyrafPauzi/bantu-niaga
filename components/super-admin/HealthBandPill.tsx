import { cn } from "@/lib/utils/cn";
import type { HealthBand } from "@/lib/super-admin/health";
import { healthBandLabel } from "@/lib/super-admin/health";

const TONES: Record<HealthBand, string> = {
  healthy: "bg-status-success/15 text-status-success",
  watch: "bg-status-warning/15 text-status-warning",
  at_risk: "bg-orange-100 text-orange-700",
  critical: "bg-status-danger/15 text-status-danger",
};

export function HealthBandPill({
  band,
  score,
}: {
  band?: HealthBand;
  score?: number;
}) {
  if (!band) {
    return (
      <span className="text-xs text-ink-muted">—</span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold",
        TONES[band],
      )}
    >
      {healthBandLabel(band)}
      {typeof score === "number" ? (
        <span className="opacity-80">· {score}</span>
      ) : null}
    </span>
  );
}
