"use client";

import { useEffect, useRef } from "react";

/**
 * Ensures the current browser is recorded in user_sessions once per mount.
 * Uses GET (ensure/touch) so repeat visits only update last_seen_at.
 */
export function SessionRegistrar() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void fetch("/api/settings/security/sessions/register", {
      method: "GET",
      credentials: "same-origin",
    }).catch(() => {
      // Non-fatal — security page will retry.
    });
  }, []);

  return null;
}
