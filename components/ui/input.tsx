import { cn } from "@/lib/utils/cn";
import { ChevronDown } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/* ─── Label ─────────────────────────────────────────────────── */

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-ink dark:text-cream-100 mb-1.5",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-status-danger" aria-hidden="true">*</span>
      )}
    </label>
  );
}

/* ─── Hint / FieldError ─────────────────────────────────────── */

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1.5 text-xs text-ink-muted dark:text-cream-400", className)} {...props} />
  );
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1.5 text-xs text-status-danger", className)} role="alert" {...props} />
  );
}

/* ─── Shared input chrome ────────────────────────────────────── */

const inputBase =
  "block w-full rounded-lg border bg-panel-light text-ink placeholder:text-ink-subtle transition-colors " +
  "dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-cream-100 dark:focus-visible:ring-offset-surface-dark " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const inputBorderNormal =
  "border-hairline-light dark:border-hairline-dark hover:border-cream-400 dark:hover:border-cream-400/40";

const inputBorderError =
  "border-status-danger focus-visible:ring-status-danger/40";

/* ─── Input ─────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ error, leading, trailing, className, ...props }, ref) {
    if (leading || trailing) {
      return (
        <div className="relative flex items-center">
          {leading && (
            <span className="pointer-events-none absolute left-3 flex items-center text-ink-muted dark:text-cream-400">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputBase,
              error ? inputBorderError : inputBorderNormal,
              "h-11 text-sm",
              leading ? "pl-9" : "pl-3",
              trailing ? "pr-9" : "pr-3",
              className,
            )}
            {...props}
          />
          {trailing && (
            <span className="pointer-events-none absolute right-3 flex items-center text-ink-muted dark:text-cream-400">
              {trailing}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          inputBase,
          error ? inputBorderError : inputBorderNormal,
          "h-11 px-3 text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);

/* ─── Textarea ───────────────────────────────────────────────── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ error, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          inputBase,
          error ? inputBorderError : inputBorderNormal,
          "min-h-[100px] px-3 py-2.5 text-sm resize-y",
          className,
        )}
        {...props}
      />
    );
  },
);

/* ─── Select ─────────────────────────────────────────────────── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ error, className, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            inputBase,
            error ? inputBorderError : inputBorderNormal,
            "h-11 pl-3 pr-9 text-sm appearance-none cursor-pointer",
            className,
          )}
          {...props}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted dark:text-cream-400">
          <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>
    );
  },
);

/* ─── Checkbox ───────────────────────────────────────────────── */

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, description, className, id, ...props }, ref) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={cn(
            "mt-0.5 h-4 w-4 rounded border-hairline-light dark:border-hairline-dark",
            "accent-brand-500 cursor-pointer",
            "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
          )}
          {...props}
        />
        {(label || description) && (
          <div className="min-w-0">
            {label && (
              <label htmlFor={id} className="block text-sm font-medium text-ink dark:text-cream-100 cursor-pointer">
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-ink-muted dark:text-cream-400 mt-0.5">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  },
);

/* ─── FormField (label + input + hint/error) ─────────────────── */

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, htmlFor, hint, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <FieldHint>{hint}</FieldHint>
      ) : null}
    </div>
  );
}
