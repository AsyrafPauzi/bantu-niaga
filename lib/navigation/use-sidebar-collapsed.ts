"use client";

import { useCallback, useEffect, useState } from "react";
import { TABLET_MEDIA_QUERY } from "@/lib/navigation/breakpoints";

const STORAGE_KEY = "bantuniaga.sidebar.collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === "1");
      } else {
        const tablet = window.matchMedia(TABLET_MEDIA_QUERY).matches;
        setCollapsed(tablet);
      }
    } catch {
      // private mode / quota — keep default expanded
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { collapsed, toggle, ready };
}
