export interface OnboardingProgress {
  total: number;
  done: number;
  open: number;
  percent: number;
}

export function computeOnboardingProgress(
  items: ReadonlyArray<{ is_done: boolean }>,
): OnboardingProgress {
  const total = items.length;
  const done = items.filter((item) => item.is_done).length;
  const open = total - done;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, open, percent };
}

export function formatOnboardingProgress(progress: OnboardingProgress): string {
  if (progress.total === 0) {
    return "No checklist items yet";
  }
  if (progress.open === 0) {
    return `All ${progress.total} complete`;
  }
  return `${progress.done} of ${progress.total} done · ${progress.open} remaining`;
}

export function onboardingProgressFromCounts(
  done: number,
  total: number,
): OnboardingProgress {
  const open = Math.max(0, total - done);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, open, percent };
}
