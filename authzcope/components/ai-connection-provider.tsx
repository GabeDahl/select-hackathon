"use client";

import { createContext, startTransition, useContext, useState } from "react";
import { useStore } from "zustand";
import { configureAi, verifyAiConnection } from "@/app/actions/configure-ai";
import { createAiStore, type AiState } from "@/lib/ai-store";
import type { AiConfigurationStatus, AiConnectionInput, AiConnectionResult } from "@/lib/ai-connection-types";

const AiContext = createContext<ReturnType<typeof createAiStore> | null>(null);

function transport(action: (input: AiConnectionInput) => Promise<AiConnectionResult>) {
  return (input: AiConnectionInput) => new Promise<AiConnectionResult>((resolve, reject) => {
    startTransition(async () => {
      try { resolve(await action(input)); }
      catch (error) { reject(error); }
    });
  });
}

export function AiConnectionProvider({ configuration, children }: {
  configuration: AiConfigurationStatus; children: React.ReactNode;
}) {
  const [store] = useState(() => createAiStore(configuration, transport(configureAi), transport(verifyAiConnection)));
  return <AiContext.Provider value={store}>{children}</AiContext.Provider>;
}

export function useAiStoreApi() {
  const store = useContext(AiContext);
  if (!store) throw new Error("AI state requires AiConnectionProvider.");
  return store;
}

export function useAiStore<T>(selector: (state: AiState) => T): T {
  return useStore(useAiStoreApi(), selector);
}
