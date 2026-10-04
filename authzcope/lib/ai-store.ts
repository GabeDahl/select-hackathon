import { createStore } from "zustand/vanilla";
import { AI_DEFAULT_MODELS, type AiConfigurationStatus, type AiConnectionInput, type AiConnectionResult } from "./ai-connection-types.ts";

type AiTransport = (input: AiConnectionInput) => Promise<AiConnectionResult>;

export type AiState = {
  configuration: AiConfigurationStatus;
  input: AiConnectionInput;
  result: AiConnectionResult | null;
  pending: "settings" | "connection" | null;
  updateInput: (changes: Partial<AiConnectionInput>) => void;
  checkSettings: () => Promise<void>;
  testConnection: () => Promise<void>;
};

// Provider-scoped tab memory. No persistence, devtools, or shared server state.
export function createAiStore(configuration: AiConfigurationStatus, check: AiTransport, verify: AiTransport) {
  let generation = 0;
  return createStore<AiState>()((set, get) => {
    async function request(stage: "settings" | "connection", transport: AiTransport) {
      if (get().pending) return;
      const requestId = ++generation;
      const input = { ...get().input };
      set({ pending: stage, result: null });
      let result: AiConnectionResult;
      try { result = await transport(input); }
      catch { result = { ok: false, message: "The AI request failed. Please try again." }; }
      if (requestId !== generation) return;
      set({ pending: null, result });
    }
    return {
      configuration,
      input: { aiProvider: "openai", aiModel: AI_DEFAULT_MODELS.openai, aiApiKey: "" },
      result: null,
      pending: null,
      updateInput(changes) {
        generation += 1;
        const nextProvider = changes.aiProvider ?? get().input.aiProvider;
        const providerChanged = nextProvider !== get().input.aiProvider;
        set((state) => ({
          input: { ...state.input, ...(providerChanged ? { aiModel: AI_DEFAULT_MODELS[nextProvider], aiApiKey: "" } : {}), ...changes },
          result: null,
          pending: null,
        }));
      },
      checkSettings: () => request("settings", check),
      testConnection: () => request("connection", verify),
    };
  });
}
