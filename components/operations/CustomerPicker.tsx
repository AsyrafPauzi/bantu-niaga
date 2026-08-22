"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Loader2, UserCheck, X } from "lucide-react";

export interface CustomerPickerValue {
  id: string;
  name: string;
  phone_e164: string | null;
}

interface CustomerPickerProps {
  /** Current free-text customer name (controlled by parent) */
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  /** Set when a customer record is linked */
  linkedCustomer: CustomerPickerValue | null;
  onLink: (customer: CustomerPickerValue) => void;
  onUnlink: () => void;
  placeholder?: string;
  required?: boolean;
}

export function CustomerPicker({
  customerName,
  onCustomerNameChange,
  linkedCustomer,
  onLink,
  onUnlink,
  placeholder = "Customer name *",
  required,
}: CustomerPickerProps) {
  const [results, setResults] = useState<CustomerPickerValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/operations/customer-search?q=${encodeURIComponent(q)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: CustomerPickerValue[];
      };
      if (json.ok && json.data) {
        setResults(json.data);
        setOpen(json.data.length > 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onCustomerNameChange(val);
    if (linkedCustomer) onUnlink();
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(val), 300);
  };

  const handleSelect = (c: CustomerPickerValue) => {
    onLink(c);
    onCustomerNameChange(c.name);
    setOpen(false);
    setResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={customerName}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm pr-8 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" />
          ) : linkedCustomer ? (
            <button
              type="button"
              className="pointer-events-auto"
              onClick={onUnlink}
              aria-label="Unlink customer"
            >
              <X className="h-3.5 w-3.5 text-status-danger" />
            </button>
          ) : null}
        </span>
      </div>

      {linkedCustomer ? (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-700 dark:text-brand-300">
          <UserCheck className="h-3 w-3" />
          Linked to customer record
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-cream-200 bg-white shadow-lg dark:border-hairline-dark dark:bg-panel-dark">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(c)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-cream-50 dark:hover:bg-hairline-dark/40"
              >
                <span className="font-medium text-ink dark:text-cream-100">
                  {c.name}
                </span>
                {c.phone_e164 ? (
                  <span className="text-[11px] text-ink-muted dark:text-cream-400">
                    {c.phone_e164}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
