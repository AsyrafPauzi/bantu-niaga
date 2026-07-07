"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AddonFeatureState } from "@/lib/marketplace/addon-availability";

const HrNavAddonContext = createContext<Record<string, AddonFeatureState>>({});

export function HrNavAddonProvider({
  states,
  children,
}: {
  states: Record<string, AddonFeatureState>;
  children: ReactNode;
}) {
  return (
    <HrNavAddonContext.Provider value={states}>{children}</HrNavAddonContext.Provider>
  );
}

export function useHrNavAddonStates(): Record<string, AddonFeatureState> {
  return useContext(HrNavAddonContext);
}
