"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the caught error. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Module / feature label used in the default fallback message */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Shared ErrorBoundary for client components.
 *
 * Usage:
 *   <ErrorBoundary label="Finance">
 *     <FinanceInvoiceComposer />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={(err, reset) => <button onClick={reset}>Retry</button>}>
 *     <HeavyPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; in production this surfaces in Vercel logs.
    // Replace with your logger if running a Node edge handler.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    const label = this.props.label ?? "This section";

    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-400">
            {label} failed to load
          </p>
          <p className="mt-1 text-sm text-red-600/70 dark:text-red-500/70">
            Something went wrong. Please try refreshing the page.
          </p>
        </div>
        <button
          onClick={this.reset}
          className="mt-1 rounded-lg border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
