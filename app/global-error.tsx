"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js global error boundary — catches errors thrown by the root layout itself.
 * Must render its own <html> and <body> because the normal layout won't mount.
 * Raw error details are logged server-side only; never exposed to the DOM.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[GlobalError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafaf9" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "3.5rem",
              width: "3.5rem",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "1rem",
              background: "#fee2e2",
            }}
          >
            <AlertTriangle style={{ height: "1.75rem", width: "1.75rem", color: "#ef4444" }} />
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#1a1a1a" }}>
              NiagaX encountered an unexpected error
            </h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280", maxWidth: "28rem" }}>
              We&apos;re sorry — something went wrong on our end. Your data is safe.
              Please try refreshing the page. If the problem continues, contact support.
            </p>
            {error.digest && (
              <p style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.6875rem", color: "#9ca3af" }}>
                Error ref: {error.digest}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "0.75rem",
                background: "#0e7490",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.5rem 1rem",
              }}
            >
              <RefreshCw style={{ height: "0.875rem", width: "0.875rem" }} />
              Try again
            </button>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "0.75rem",
                border: "1px solid #e5e7eb",
                color: "#6b7280",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.5rem 1rem",
                textDecoration: "none",
              }}
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
