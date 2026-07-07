"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HrOnboardingRow } from "@/lib/hr/load";
import { HrOnboardingCreateForm } from "@/components/hr/HrOnboardingCreateForm";
import { HrOnboardingProgress } from "@/components/hr/HrOnboardingProgress";
import { HrOnboardingStatusActions } from "@/components/hr/HrOnboardingStatusActions";

export function HrOnboardingPanel({
  employeeId,
  items,
}: {
  employeeId: string;
  items: HrOnboardingRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const open = items.filter((item) => !item.is_done);
  const done = items.filter((item) => item.is_done);

  return (
    <div className="space-y-4">
      <HrOnboardingProgress items={items} />

      {open.length === 0 && items.length > 0 ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          All onboarding items are complete.
        </p>
      ) : open.length === 0 ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          Add checklist items to track IC, contract, and first-day tasks.
        </p>
      ) : (
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {open.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="text-sm text-ink dark:text-cream-100">{item.label}</span>
              <HrOnboardingStatusActions
                itemId={item.id}
                isDone={item.is_done}
                onUpdated={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink-muted dark:text-cream-400">
            Completed ({done.length})
          </summary>
          <ul className="mt-2 space-y-1 text-ink-muted dark:text-cream-400">
            {done.map((item) => (
              <li key={item.id} className="line-through opacity-80">
                {item.label}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {showForm ? (
        <HrOnboardingCreateForm
          employeeId={employeeId}
          onCreated={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold text-brand-700 dark:text-brand-200"
        >
          + Add checklist item
        </button>
      )}
    </div>
  );
}
