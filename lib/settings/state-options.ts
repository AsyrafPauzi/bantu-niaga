import { STATE_LABELS } from "@/lib/hr/state-codes";

export const MALAYSIA_STATE_OPTIONS = Object.entries(STATE_LABELS)
  .map(([code, label]) => ({ code, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const MALAYSIA_STATE_CODES = Object.keys(STATE_LABELS) as [
  string,
  ...string[],
];
