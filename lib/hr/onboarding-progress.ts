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

/** Batch onboarding % per employee from a flat checklist list (no N+1). */
export function onboardingProgressByEmployeeId(
  items: ReadonlyArray<{ employee_id: string; is_done: boolean }>,
): Map<string, OnboardingProgress> {
  const byEmployee = new Map<string, { is_done: boolean }[]>();
  for (const item of items) {
    const list = byEmployee.get(item.employee_id);
    if (list) {
      list.push({ is_done: item.is_done });
    } else {
      byEmployee.set(item.employee_id, [{ is_done: item.is_done }]);
    }
  }
  const out = new Map<string, OnboardingProgress>();
  for (const [employeeId, list] of byEmployee) {
    out.set(employeeId, computeOnboardingProgress(list));
  }
  return out;
}
