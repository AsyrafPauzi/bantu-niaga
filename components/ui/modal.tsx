"use client";

import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type HTMLAttributes } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { createPortal } from "react-dom";

/* ─── Types ──────────────────────────────────────────────────── */

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  /** Prevent closing on backdrop click */
  persistent?: boolean;
  className?: string;
  children: React.ReactNode;
}

/* ─── Size map ───────────────────────────────────────────────── */

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw]",
};

/* ─── Modal ──────────────────────────────────────────────────── */

export function Modal({ open, onClose, size = "md", persistent, className, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) onClose();
    },
    [onClose, persistent],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] animate-in fade-in"
        onClick={!persistent ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          "relative z-10 w-full rounded-t-2xl sm:rounded-2xl",
          "bg-panel-light dark:bg-panel-dark",
          "border border-hairline-light dark:border-hairline-dark",
          "shadow-xl",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200",
          "flex flex-col max-h-[90dvh] sm:max-h-[85vh]",
          sizes[size],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ─── ModalHeader ────────────────────────────────────────────── */

interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  title?: string;
  description?: string;
}

export function ModalHeader({ onClose, title, description, className, children, ...props }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 p-5 border-b border-hairline-light dark:border-hairline-dark",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title && (
          <h2 className="text-base font-semibold text-ink dark:text-cream-100 truncate">{title}</h2>
        )}
        {description && (
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">{description}</p>
        )}
        {children}
      </div>
      {onClose && (
        <Tooltip content="Close" side="left">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "shrink-0 flex items-center justify-center w-8 h-8 rounded-lg",
              "text-ink-muted hover:text-ink hover:bg-cream-200",
              "dark:text-cream-400 dark:hover:text-cream-100 dark:hover:bg-hairline-dark",
              "transition-colors focus-visible:ring-2 focus-visible:ring-brand-400",
            )}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/* ─── ModalBody ──────────────────────────────────────────────── */

export function ModalBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 min-h-0 p-5 overflow-y-auto", className)}
      {...props}
    />
  );
}

/* ─── ModalFooter ────────────────────────────────────────────── */

export function ModalFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 p-5 border-t border-hairline-light dark:border-hairline-dark",
        "sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Confirm dialog ─────────────────────────────────────────── */

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm" persistent={loading}>
      <ModalHeader onClose={onClose} title={title} description={description} />
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={cn(
            "h-10 px-4 rounded-lg text-sm font-medium transition-colors",
            "bg-cream-200 text-ink hover:bg-cream-300",
            "dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark dark:border dark:border-hairline-dark",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "h-10 px-4 rounded-lg text-sm font-medium text-white transition-colors",
            variant === "danger"
              ? "bg-status-danger hover:opacity-90"
              : "bg-brand-500 hover:bg-brand-600",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {loading ? "Please wait…" : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
