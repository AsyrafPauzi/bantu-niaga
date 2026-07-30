"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __bnAnalyticsEnabled?: boolean;
    bnTrack?: (event: string, props?: Record<string, unknown>) => void;
  }
}

interface Props {
  enabled: boolean;
}

/**
 * Gates client-side product analytics behind the user's analytics consent.
 * When PostHog (or similar) is configured, initialise it here only if enabled.
 */
export function ProductAnalytics({ enabled }: Props) {
  useEffect(() => {
    window.__bnAnalyticsEnabled = enabled;

    window.bnTrack = (event, props) => {
      if (!window.__bnAnalyticsEnabled) return;
      // Hook for a future PostHog / GA integration — consent is enforced here.
      if (process.env.NODE_ENV === "development") {
        console.debug("[analytics]", event, props ?? {});
      }
    };

    return () => {
      window.__bnAnalyticsEnabled = false;
      delete window.bnTrack;
    };
  }, [enabled]);

  return null;
}
