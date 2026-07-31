"use client";

import { useMode } from "@/lib/use-mode";
import type { ReactNode } from "react";

/** Client switch for customer detail — server renders both subtrees once. */
export function CustomerDetailAdaptive({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const mode = useMode();
  return <>{mode === "mobile" ? mobile : desktop}</>;
}
