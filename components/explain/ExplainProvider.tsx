"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ExplainPayload } from "@/lib/types";
import {
  buildDimensionExplainPayload,
  buildRiskExplainPayload,
} from "@/lib/explain";
import { ExplainDrawer } from "./ExplainDrawer";

interface ExplainContextValue {
  openRisk: (riskId: string) => void;
  openDimension: (dimensionId: string) => void;
  close: () => void;
  isOpen: boolean;
  payload: ExplainPayload | null;
}

const ExplainContext = createContext<ExplainContextValue | null>(null);

export function ExplainProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<ExplainPayload | null>(null);

  const openRisk = useCallback((riskId: string) => {
    const p = buildRiskExplainPayload(riskId);
    if (p) setPayload(p);
  }, []);

  const openDimension = useCallback((dimensionId: string) => {
    const p = buildDimensionExplainPayload(dimensionId);
    if (p) setPayload(p);
  }, []);

  const close = useCallback(() => setPayload(null), []);

  return (
    <ExplainContext.Provider
      value={{
        openRisk,
        openDimension,
        close,
        isOpen: payload !== null,
        payload,
      }}
    >
      {children}
      <ExplainDrawer payload={payload} onClose={close} />
    </ExplainContext.Provider>
  );
}

export function useExplain() {
  const ctx = useContext(ExplainContext);
  if (!ctx) {
    throw new Error("useExplain must be used within ExplainProvider");
  }
  return ctx;
}

export function useExplainOptional() {
  return useContext(ExplainContext);
}
