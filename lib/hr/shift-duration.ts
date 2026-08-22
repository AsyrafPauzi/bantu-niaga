/** Elapsed shift length from clock-in until `until` (default now). */
export function formatShiftDuration(
  clockInIso: string,
  until: Date = new Date(),
): string {
  const start = new Date(clockInIso).getTime();
  if (Number.isNaN(start)) return "—";
  const ms = Math.max(0, until.getTime() - start);
  const totalMins = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
