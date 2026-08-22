"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OperationsCustomerHint } from "@/lib/operations/customer-hints";

interface OperationsCustomerFieldsProps {
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  linkedCustomerId?: string | null;
  onLink?: (customerId: string, name: string, phone: string | null) => void;
  onUnlink?: () => void;
  localHints?: OperationsCustomerHint[];
  nameRequired?: boolean;
  className?: string;
}

interface CustomerSuggestion {
  id?: string;
  name: string;
  phone: string | null;
  source: "local" | "db";
}

export function OperationsCustomerFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  linkedCustomerId,
  onLink,
  onUnlink,
  localHints = [],
  nameRequired = true,
  className,
}: OperationsCustomerFieldsProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<CustomerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    const map = new Map<string, CustomerSuggestion>();

    const add = (item: CustomerSuggestion) => {
      const key = item.name.trim().toLowerCase();
      if (!key) return;
      if (
        q &&
        !key.includes(q) &&
        !(item.phone?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ?? false)
      ) {
        return;
      }
      const existing = map.get(key);
      if (!existing || (item.source === "db" && existing.source === "local")) {
        map.set(key, item);
      }
    };

    for (const hint of localHints) {
      add({ name: hint.name, phone: hint.phone, source: "local" });
    }
    for (const hint of remote) {
      add(hint);
    }

    return Array.from(map.values()).slice(0, 8);
  }, [localHints, name, remote]);

  useEffect(() => {
    const q = name.trim();
    if (q.length < 1) {
      setRemote([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/operations/customer-search?q=${encodeURIComponent(q)}`,
      )
        .then((res) => res.json())
        .then(
          (json: {
            ok?: boolean;
            data?: Array<{ id: string; name: string; phone_e164: string | null }>;
          }) => {
            if (!json.ok || !json.data) {
              setRemote([]);
              return;
            }
            setRemote(
              json.data.map((row) => ({
                id: row.id,
                name: row.name,
                phone: row.phone_e164,
                source: "db" as const,
              })),
            );
          },
        )
        .catch(() => setRemote([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [name]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const pickSuggestion = useCallback(
    (item: CustomerSuggestion) => {
      onNameChange(item.name);
      onPhoneChange(item.phone ?? "");
      setOpen(false);
      if (item.id && onLink) {
        onLink(item.id, item.name, item.phone ?? null);
      } else if (onUnlink) {
        onUnlink();
      }
    },
    [onNameChange, onPhoneChange, onLink, onUnlink],
  );

  const showList = open && (suggestions.length > 0 || loading);

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div ref={wrapRef} className="relative space-y-1">
        <label
          htmlFor={`${listId}-name`}
          className="text-xs font-semibold text-ink dark:text-cream-100"
        >
          Customer name <span className="text-status-danger">*</span>
        </label>
        <input
          id={`${listId}-name`}
          type="text"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
            setOpen(true);
            if (linkedCustomerId && onUnlink) onUnlink();
          }}
          onFocus={() => setOpen(true)}
          placeholder="Start typing a name…"
          required={nameRequired}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        {linkedCustomerId ? (
          <p className="flex items-center gap-1 text-[11px] text-brand-700 dark:text-brand-300">
            <UserCheck className="h-3 w-3" />
            Linked to customer record
            {onUnlink ? (
              <button type="button" onClick={onUnlink} className="ml-1" aria-label="Unlink">
                <X className="h-3 w-3 text-status-danger" />
              </button>
            ) : null}
          </p>
        ) : null}
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-cream-200 bg-white py-1 shadow-lg dark:border-hairline-dark dark:bg-panel-dark"
          >
            {loading ? (
              <li className="flex items-center gap-2 px-3 py-2 text-xs text-ink-muted dark:text-cream-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </li>
            ) : null}
            {suggestions.map((item) => (
              <li key={`${item.source}-${item.name}`}>
                <button
                  type="button"
                  role="option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(item)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50 dark:hover:bg-hairline-dark/40"
                >
                  <span className="truncate font-medium text-ink dark:text-cream-100">
                    {item.name}
                  </span>
                  {item.phone ? (
                    <span className="shrink-0 text-xs text-ink-muted dark:text-cream-400">
                      {item.phone}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="space-y-1">
        <label
          htmlFor={`${listId}-phone`}
          className="text-xs font-semibold text-ink dark:text-cream-100"
        >
          WhatsApp / phone
        </label>
        <input
          id={`${listId}-phone`}
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+60…"
          autoComplete="tel"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
    </div>
  );
}
