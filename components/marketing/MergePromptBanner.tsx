"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Inline alert shown above the customer form when the create endpoint
 * returned `action: "prompt"` — phone matched an existing customer
 * but the names diverge enough that we can't auto-merge.
 *
 * Two actions:
 *   - "Merge into existing"  → POST /merge then navigate to the surviving id
 *   - "Keep separate"        → re-POST create with `force_create: true`
 */

interface MergePromptBannerProps {
  existingCustomerId: string;
  existingName: string;
  onMerge: () => void;
  onKeepSeparate: () => void;
  className?: string;
  disabled?: boolean;
}

export function MergePromptBanner({
  existingCustomerId,
  existingName,
  onMerge,
  onKeepSeparate,
  className,
  disabled = false,
}: MergePromptBannerProps) {
  return (
    <div
      role="alert"
      data-existing-id={existingCustomerId}
      className={cn(
        "rounded-lg border border-[#F5C97A] bg-[#FDF2DC] p-4",
        "dark:border-[#8C5C0A] dark:bg-[#3A2A0A]",
        className,
      )}
    >
      <p className="text-sm font-semibold text-[#8C5C0A] dark:text-[#F5C97A]">
        Looks like this might be the same customer
      </p>
      <p className="mt-1 text-sm text-ink dark:text-cream-100">
        Phone already belongs to{" "}
        <span className="font-medium">{existingName}</span>. Merge this
        record into the existing one, or keep them as separate customers.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onMerge}
          disabled={disabled}
          data-action="merge"
        >
          Merge into existing
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onKeepSeparate}
          disabled={disabled}
          data-action="keep-separate"
        >
          Keep separate
        </Button>
      </div>
    </div>
  );
}
