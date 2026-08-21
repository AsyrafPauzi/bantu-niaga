"use client";

import { type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { OperationsCatalogEditShell } from "@/components/operations/OperationsCatalogUi";
import { type OperationsBookingResourceRow } from "@/lib/operations/schemas";

interface BookingEditFormProps {
  resources: OperationsBookingResourceRow[];
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (v: string) => void;
  serviceTitle: string;
  onServiceTitleChange: (v: string) => void;
  resourceId: string;
  onResourceIdChange: (v: string) => void;
  startsAt: string;
  onStartsAtChange: (v: string) => void;
  endsAt: string;
  onEndsAtChange: (v: string) => void;
  amountMyr: string;
  onAmountMyrChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  creating: boolean;
  formError: string | null;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function BookingEditForm({
  resources,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  serviceTitle,
  onServiceTitleChange,
  resourceId,
  onResourceIdChange,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  amountMyr,
  onAmountMyrChange,
  notes,
  onNotesChange,
  creating,
  formError,
  onSubmit,
  onCancel,
}: BookingEditFormProps) {
  return (
    <OperationsCatalogEditShell title="Reschedule booking" accent="violet">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Customer name *"
            required
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="Phone / WhatsApp"
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </div>
        <input
          type="text"
          value={serviceTitle}
          onChange={(e) => onServiceTitleChange(e.target.value)}
          placeholder="Service *"
          required
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <select
          value={resourceId}
          onChange={(e) => onResourceIdChange(e.target.value)}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          <option value="">No resource / walk-in</option>
          {resources
            .filter((r) => r.is_active)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block text-ink-muted dark:text-cream-400">
              Starts *
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => onStartsAtChange(e.target.value)}
              required
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-ink-muted dark:text-cream-400">
              Ends *
            </span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => onEndsAtChange(e.target.value)}
              required
              className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </label>
        </div>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amountMyr}
          onChange={(e) => onAmountMyrChange(e.target.value)}
          placeholder="Amount (MYR, optional)"
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Notes"
          rows={2}
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        {formError ? (
          <p className="text-sm text-status-danger">{formError}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </OperationsCatalogEditShell>
  );
}
