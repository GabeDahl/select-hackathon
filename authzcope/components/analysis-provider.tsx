"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { requestAuthorizationAnalysis } from "@/lib/analysis-transport";
import { createAnalysisStore, subscribeToAnalysisInputs, type AnalysisState } from "@/lib/analysis-store";
import { useWorkspaceStoreApi } from "@/components/database-connection-provider";
import { useAiStoreApi } from "@/components/ai-connection-provider";

const AnalysisContext = createContext<ReturnType<typeof createAnalysisStore> | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspaceStoreApi(), ai = useAiStoreApi();
  const [store] = useState(() => createAnalysisStore(workspace, ai, requestAuthorizationAnalysis));
  useEffect(() => {
    const stop = subscribeToAnalysisInputs(store, workspace, ai);
    return () => { stop(); store.getState().cancel(); };
  }, [store, workspace, ai]);
  return <AnalysisContext.Provider value={store}>{children}</AnalysisContext.Provider>;
}

export function useAnalysisStoreApi() {
  const store = useContext(AnalysisContext);
  if (!store) throw new Error("Analysis state requires AnalysisProvider.");
  return store;
}

export function useAnalysisStore<T>(selector: (state: AnalysisState) => T): T {
  return useStore(useAnalysisStoreApi(), selector);
}
