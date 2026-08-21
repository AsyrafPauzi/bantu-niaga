"use client";

import { cn } from "@/lib/utils/cn";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* ─── Types ──────────────────────────────────────────────────── */

type ToastTone = "success" | "danger" | "warning" | "info";

interface Toast {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<Toast, "id">) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

/* ─── Context ────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ─── Token maps ─────────────────────────────────────────────── */

const toneConfig: Record<
  ToastTone,
  { wrapper: string; icon: string; titleColor: string; textColor: string; Icon: React.FC<{ size?: number }> }
> = {
  success: {
    wrapper: "bg-panel-light dark:bg-panel-dark border-brand-200 dark:border-brand-700/30",
    icon: "text-brand-600 dark:text-brand-300",
    titleColor: "text-ink dark:text-cream-100",
    textColor: "text-ink-muted dark:text-cream-400",
    Icon: CheckCircle2,
  },
  danger: {
    wrapper: "bg-panel-light dark:bg-panel-dark border-status-danger/30",
    icon: "text-status-danger dark:text-[#F0B0A6]",
    titleColor: "text-ink dark:text-cream-100",
    textColor: "text-ink-muted dark:text-cream-400",
    Icon: AlertCircle,
  },
  warning: {
    wrapper: "bg-panel-light dark:bg-panel-dark border-[#D89614]/30",
    icon: "text-[#D89614] dark:text-[#F5C97A]",
    titleColor: "text-ink dark:text-cream-100",
    textColor: "text-ink-muted dark:text-cream-400",
    Icon: AlertTriangle,
  },
  info: {
    wrapper: "bg-panel-light dark:bg-panel-dark border-[#2D6A8A]/30",
    icon: "text-[#2D6A8A] dark:text-[#A6CFE0]",
    titleColor: "text-ink dark:text-cream-100",
    textColor: "text-ink-muted dark:text-cream-400",
    Icon: Info,
  },
};

/* ─── Single Toast item ──────────────────────────────────────── */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = toneConfig[toast.tone];
  const Icon = cfg.Icon;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const duration = toast.duration ?? 4500;
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border shadow-elevated",
        "animate-in slide-in-from-right-5 fade-in duration-200",
        cfg.wrapper,
      )}
    >
      <span className={cn("shrink-0 mt-0.5", cfg.icon)}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={cn("text-sm font-semibold leading-snug", cfg.titleColor)}>{toast.title}</p>
        )}
        <p className={cn("text-sm leading-relaxed", toast.title ? "mt-0.5" : "", cfg.textColor)}>
          {toast.message}
        </p>
      </div>
      <Tooltip content="Dismiss" side="left">
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-ink-muted hover:text-ink hover:bg-cream-200 dark:text-cream-400 dark:hover:text-cream-100 dark:hover:bg-hairline-dark transition-colors"
        >
          <X size={14} />
        </button>
      </Tooltip>
    </div>
  );
}

/* ─── ToastProvider ──────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...options, id }]);
  }, []);

  const api: ToastContextValue = {
    toast: addToast,
    success: (message, title) => addToast({ tone: "success", message, title }),
    error: (message, title) => addToast({ tone: "danger", message, title }),
    warning: (message, title) => addToast({ tone: "warning", message, title }),
    info: (message, title) => addToast({ tone: "info", message, title }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-label="Notifications"
            className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
