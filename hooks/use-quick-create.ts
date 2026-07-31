"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface UseQuickCreateOptions {
  /** Open panel on mount when URL has `?create=1` */
  listenForCreateParam?: boolean;
  /** Force open on mount (e.g. when editing) */
  defaultOpen?: boolean;
}

export function useQuickCreate(options: UseQuickCreateOptions = {}) {
  const { listenForCreateParam = true, defaultOpen = false } = options;
  const searchParams = useSearchParams();
  const createFromUrl =
    listenForCreateParam && searchParams.get("create") === "1";

  const [open, setOpen] = useState(defaultOpen || createFromUrl);

  useEffect(() => {
    if (createFromUrl) setOpen(true);
  }, [createFromUrl]);

  const openPanel = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return { open, setOpen, openPanel, close, toggle };
}
