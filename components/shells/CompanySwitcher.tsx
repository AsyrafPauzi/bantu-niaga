"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2, LogIn, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { apiErrorMessage } from "@/lib/api/client-error";
import { MAX_OWNED_BUSINESSES_PER_USER } from "@/lib/auth/owned-business-limits";
import type { BusinessMembership } from "@/lib/auth/memberships";

interface CompanySwitcherProps {
  memberships: BusinessMembership[];
  compact?: boolean;
  canCreateCompany?: boolean;
}

export function CompanySwitcher({
  memberships,
  compact = false,
  canCreateCompany = true,
}: CompanySwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    memberships.find((m) => m.isActive) ?? memberships[0] ?? null;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function handleSwitch(businessId: string) {
    if (!active || businessId === active.businessId) {
      setOpen(false);
      return;
    }
    setError(null);
    setSwitching(businessId);
    try {
      const res = await fetch("/api/auth/switch-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(json, "Could not switch company"));
        return;
      }
      setOpen(false);
      router.replace("/home");
      router.refresh();
    } finally {
      setSwitching(null);
    }
  }

  if (!active) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-[#D5E2FB] bg-white/80 px-3 py-2.5 text-left transition-colors hover:bg-white dark:border-hairline-dark dark:bg-panel-dark/80 dark:hover:bg-panel-dark",
          compact ? "py-2" : "",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Building2 className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink dark:text-cream-100">
            {active.businessName}
          </span>
          {!compact ? (
            <span className="block truncate text-[10px] text-ink-muted dark:text-cream-400">
              Tap to switch company
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-muted transition-transform dark:text-cream-400",
            open ? "rotate-180" : "",
          )}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-[#E5E0D8] bg-white shadow-lg dark:border-hairline-dark dark:bg-panel-dark"
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {memberships.map((m) => {
              const pending = switching === m.businessId;
              return (
                <button
                  key={m.businessId}
                  type="button"
                  role="option"
                  aria-selected={m.isActive}
                  disabled={pending}
                  onClick={() => handleSwitch(m.businessId)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-cream-100 disabled:opacity-60 dark:hover:bg-hairline-dark/60"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink dark:text-cream-100">
                    {m.businessName}
                  </span>
                  {pending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
                  ) : m.isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[#E5E0D8] p-1 dark:border-hairline-dark">
            {canCreateCompany ? (
              <Link
                href="/add-company"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-900/30"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
                Create new company
              </Link>
            ) : (
              <p className="px-3 py-2.5 text-xs text-ink-muted dark:text-cream-400">
                Company limit reached ({MAX_OWNED_BUSINESSES_PER_USER} owned)
              </p>
            )}
            <Link
              href="/sign-in?reason=switch_account"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-cream-100 dark:text-cream-400 dark:hover:bg-hairline-dark/60"
            >
              <LogIn className="h-4 w-4 shrink-0" strokeWidth={2} />
              Sign in to another account
            </Link>
          </div>
          {error ? (
            <p className="border-t border-status-danger/20 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
