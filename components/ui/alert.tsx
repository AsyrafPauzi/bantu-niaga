import { cn } from "@/lib/utils/cn";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useState, type HTMLAttributes } from "react";
import { Tooltip } from "@/components/ui/tooltip";

/* ─── Types ──────────────────────────────────────────────────── */

type AlertTone = "info" | "success" | "warning" | "danger";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  dismissible?: boolean;
  icon?: React.ReactNode;
}

/* ─── Token maps ─────────────────────────────────────────────── */

const toneConfig: Record<
  AlertTone,
  { wrapper: string; icon: string; titleColor: string; bodyColor: string; dismissColor: string; Icon: React.FC<{ size?: number }> }
> = {
  info: {
    wrapper: "bg-[#DCE9F0] border-[#2D6A8A]/20 dark:bg-[#13303D] dark:border-[#2D6A8A]/30",
    icon: "text-[#2D6A8A] dark:text-[#A6CFE0]",
    titleColor: "text-[#1F4E66] dark:text-[#A6CFE0]",
    bodyColor: "text-[#2D6A8A] dark:text-[#7AB8D0]",
    dismissColor: "text-[#2D6A8A] hover:bg-[#2D6A8A]/10 dark:text-[#A6CFE0] dark:hover:bg-[#2D6A8A]/20",
    Icon: Info,
  },
  success: {
    wrapper: "bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-700/30",
    icon: "text-brand-600 dark:text-brand-300",
    titleColor: "text-brand-800 dark:text-brand-200",
    bodyColor: "text-brand-700 dark:text-brand-300",
    dismissColor: "text-brand-600 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900/40",
    Icon: CheckCircle2,
  },
  warning: {
    wrapper: "bg-[#FDF2DC] border-[#D89614]/20 dark:bg-[#3A2A0A] dark:border-[#D89614]/20",
    icon: "text-[#D89614] dark:text-[#F5C97A]",
    titleColor: "text-[#8C5C0A] dark:text-[#F5C97A]",
    bodyColor: "text-[#8C5C0A]/80 dark:text-[#D4AA60]",
    dismissColor: "text-[#8C5C0A] hover:bg-[#D89614]/10 dark:text-[#F5C97A] dark:hover:bg-[#D89614]/10",
    Icon: AlertTriangle,
  },
  danger: {
    wrapper: "bg-[#F8DDD9] border-status-danger/20 dark:bg-[#3A1714] dark:border-status-danger/30",
    icon: "text-status-danger dark:text-[#F0B0A6]",
    titleColor: "text-[#8B2418] dark:text-[#F0B0A6]",
    bodyColor: "text-[#8B2418]/80 dark:text-[#D4908A]",
    dismissColor: "text-[#8B2418] hover:bg-status-danger/10 dark:text-[#F0B0A6] dark:hover:bg-status-danger/10",
    Icon: AlertCircle,
  },
};

/* ─── Alert ──────────────────────────────────────────────────── */

export function Alert({ tone = "info", title, dismissible, icon, className, children, ...props }: AlertProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const cfg = toneConfig[tone];
  const Icon = cfg.Icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        cfg.wrapper,
        className,
      )}
      {...props}
    >
      <span className={cn("shrink-0 mt-0.5", cfg.icon)}>
        {icon ?? <Icon size={16} />}
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn("text-sm font-semibold leading-snug", cfg.titleColor)}>{title}</p>
        )}
        {children && (
          <div className={cn("text-sm leading-relaxed", title ? "mt-1" : "", cfg.bodyColor)}>
            {children}
          </div>
        )}
      </div>
      {dismissible && (
        <Tooltip content="Dismiss" side="top">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className={cn(
              "shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-colors",
              cfg.dismissColor,
            )}
          >
            <X size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/* ─── InlineFeedback (form-level error/success) ──────────────── */

interface InlineFeedbackProps {
  tone?: AlertTone;
  className?: string;
  children: React.ReactNode;
}

export function InlineFeedback({ tone = "danger", className, children }: InlineFeedbackProps) {
  const cfg = toneConfig[tone];
  const Icon = cfg.Icon;
  return (
    <div className={cn("flex items-center gap-2 text-sm", cfg.bodyColor, className)}>
      <Icon size={14} className="shrink-0" />
      <span>{children}</span>
    </div>
  );
}
