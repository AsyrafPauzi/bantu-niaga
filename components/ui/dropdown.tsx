"use client";

import { cn } from "@/lib/utils/cn";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* ─── Types ──────────────────────────────────────────────────── */

type DropdownAlign = "start" | "end" | "center";

interface DropdownContextValue {
  open: boolean;
  close: () => void;
}

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: DropdownAlign;
  className?: string;
  /** Width of the dropdown panel */
  width?: string;
}

/* ─── Dropdown ───────────────────────────────────────────────── */

export function Dropdown({ trigger, children, align = "end", className, width = "w-52" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, close]);

  const alignClass: Record<DropdownAlign, string> = {
    start: "left-0",
    end: "right-0",
    center: "left-1/2 -translate-x-1/2",
  };

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1.5 py-1",
            "rounded-xl border border-hairline-light shadow-elevated",
            "bg-panel-light dark:bg-panel-dark dark:border-hairline-dark",
            "animate-in fade-in zoom-in-95 duration-100 origin-top",
            alignClass[align],
            width,
            className,
          )}
        >
          <DropdownContext.Provider value={{ open, close }}>
            {children}
          </DropdownContext.Provider>
        </div>
      )}
    </div>
  );
}

/* ─── Context ────────────────────────────────────────────────── */

import { createContext, useContext } from "react";

const DropdownContext = createContext<DropdownContextValue>({ open: false, close: () => {} });
const useDropdown = () => useContext(DropdownContext);

/* ─── DropdownItem ───────────────────────────────────────────── */

interface DropdownItemProps extends HTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ icon, destructive, disabled, className, children, onClick, ...props }: DropdownItemProps) {
  const { close } = useDropdown();

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    onClick?.(e);
    close();
  }

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "flex w-full min-h-[44px] items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
        destructive
          ? "text-status-danger hover:bg-[#F8DDD9] dark:hover:bg-[#3A1714]"
          : "text-ink dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-hairline-dark",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className={cn("shrink-0", destructive ? "text-status-danger" : "text-ink-muted dark:text-cream-400")}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

/* ─── DropdownSeparator ──────────────────────────────────────── */

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn("my-1 h-px bg-hairline-light dark:bg-hairline-dark mx-2", className)}
    />
  );
}

/* ─── DropdownLabel ──────────────────────────────────────────── */

export function DropdownLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400",
        className,
      )}
      {...props}
    />
  );
}
