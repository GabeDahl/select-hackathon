"use client";

import { useWorkspaceStore } from "@/components/database-connection-provider";
import { useAiStore } from "@/components/ai-connection-provider";

/** Importing database evidence and generating an AI model are distinct steps. */
export function useAnalysisReadiness() {
  const databaseReady = useWorkspaceStore((state) => !!state.snapshot && !state.pending && state.result?.ok === true);
  const databasePending = useWorkspaceStore((state) => state.pending);
  const aiPending = useAiStore((state) => state.pending !== null);
  const aiReady = useAiStore((state) => !!state.input.aiModel.trim() &&
    (!!state.input.aiApiKey?.trim() || state.configuration.apiKeyConfigured[state.input.aiProvider]));
  const ready = databaseReady && aiReady && !aiPending;
  const message = databasePending ? "Importing schema…" : !databaseReady ? "Connect and import a schema to continue."
    : aiPending ? "Checking AI connection…" : !aiReady ? "Configure an AI model and API key to continue." : null;
  return { ready, message };
}
