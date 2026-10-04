"use client";

import { createContext, startTransition, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { askExplorer } from "@/app/actions/ask-explorer";
import { useAnalysisStoreApi } from "@/components/analysis-provider";
import { useAiStoreApi } from "@/components/ai-connection-provider";
import { useWorkspaceStoreApi } from "@/components/database-connection-provider";
import { createModelNavigationRegistry, emptyNavigationRegistry } from "@/lib/explorer-navigation";
import { createExplorerStore, type ExplorerState } from "@/lib/explorer-store";

const ExplorerContext = createContext<ReturnType<typeof createExplorerStore> | null>(null);

export function ExplorerNavigationProvider({ children }: { children: React.ReactNode }) {
  const analysis = useAnalysisStoreApi(), ai = useAiStoreApi(), workspace = useWorkspaceStoreApi();
  const [store] = useState(() => createExplorerStore(
    analysis.getState().model ? createModelNavigationRegistry(analysis.getState().model!) : emptyNavigationRegistry,
    () => {
      const { model, supportingContext } = analysis.getState();
      const database = workspace.getState();
      return model ? { mode: "analysis", model, analysis: {
        database: { connectionString: database.connectionString }, ai: { ...ai.getState().input },
        snapshotRevision: model.snapshotRevision, scopeOverrides: { ...database.scopeOverrides }, supportingContext,
      } } : null;
    },
    (input) => new Promise((resolve, reject) => {
      startTransition(async () => { try { resolve(await askExplorer(input)); } catch (error) { reject(error); } });
    }),
  ));
  useEffect(() => {
    const stopAnalysis = analysis.subscribe((state, previous) => {
      if (state.model !== previous.model) store.getState().replaceRegistry(state.model ? createModelNavigationRegistry(state.model) : emptyNavigationRegistry);
    });
    const stopAi = ai.subscribe((state, previous) => { if (state.input !== previous.input) store.getState().clearConversation(); });
    // Close the small gap between render and subscription installation.
    const current = analysis.getState().model;
    const registry = current ? createModelNavigationRegistry(current) : emptyNavigationRegistry;
    if (store.getState().registry.revision !== registry.revision) store.getState().replaceRegistry(registry);
    return () => { stopAnalysis(); stopAi(); };
  }, [store, analysis, ai]);
  return <ExplorerContext.Provider value={store}>{children}</ExplorerContext.Provider>;
}

export function useExplorerStoreApi() {
  const store = useContext(ExplorerContext);
  if (!store) throw new Error("Explorer state requires ExplorerNavigationProvider.");
  return store;
}
export function useExplorerStore<T>(selector: (state: ExplorerState) => T): T {
  return useStore(useExplorerStoreApi(), selector);
}
