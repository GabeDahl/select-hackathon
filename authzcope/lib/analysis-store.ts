import { createStore, type StoreApi } from "zustand/vanilla";
import type { WorkspaceState } from "./workspace-store.ts";
import type { AiState } from "./ai-store.ts";
import { ANALYSIS_CLIENT_TIMEOUT_MS, interruptedAnalysisResult } from "./analysis-request.ts";
import type { AnalysisInput, AnalysisPhase, AnalysisRequestOptions, AnalysisResult } from "./analysis-types.ts";
import type { AuthorizationModel } from "./authorization-model-types.ts";

export type AnalysisState = {
  supportingContext: string;
  model: AuthorizationModel | null;
  result: AnalysisResult | null;
  pending: boolean;
  phase: AnalysisPhase | null;
  startedAt: number | null;
  selectedPatternId: string | null;
  updateSupportingContext: (value: string) => void;
  selectPattern: (id: string) => void;
  analyze: () => Promise<void>;
  cancel: () => void;
  invalidate: () => void;
};

export function createAnalysisStore(
  workspace: StoreApi<WorkspaceState>, ai: StoreApi<AiState>,
  transport: (input: AnalysisInput, options: AnalysisRequestOptions) => Promise<AnalysisResult>,
  timeoutMs = ANALYSIS_CLIENT_TIMEOUT_MS,
) {
  let generation = 0;
  let activeRequest: AbortController | null = null;
  return createStore<AnalysisState>()((set, get) => ({
    supportingContext: "", model: null, result: null, pending: false, phase: null, startedAt: null, selectedPatternId: null,
    invalidate() {
      generation++;
      activeRequest?.abort(); activeRequest = null;
      set({ model: null, result: null, pending: false, phase: null, startedAt: null, selectedPatternId: null });
    },
    cancel() {
      if (!get().pending) return;
      generation++;
      activeRequest?.abort(); activeRequest = null;
      set({ pending: false, phase: null, startedAt: null, result: { ok: false, code: "cancelled", message: "Analysis cancelled." } });
    },
    updateSupportingContext(value) { get().invalidate(); set({ supportingContext: value }); },
    selectPattern(id) { if (get().model?.accessPatterns.some((pattern) => pattern.id === id)) set({ selectedPatternId: id }); },
    async analyze() {
      if (get().pending) return;
      const database = workspace.getState(), settings = ai.getState();
      if (!database.snapshot || database.pending || !database.result?.ok) {
        set({ result: { ok: false, code: "input", message: "Import a current schema snapshot before analyzing." } });
        return;
      }
      const request = ++generation;
      const supportingContext = get().supportingContext;
      const input: AnalysisInput = {
        database: { connectionString: database.connectionString }, ai: { ...settings.input },
        snapshotRevision: database.snapshot.revision, scopeOverrides: { ...database.scopeOverrides }, supportingContext,
      };
      const controller = new AbortController();
      activeRequest = controller;
      let onAbort: () => void = () => {};
      const interrupted = new Promise<AnalysisResult>((resolve) => {
        onAbort = () => resolve(interruptedAnalysisResult(controller.signal, get().phase ?? "starting"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const timer = setTimeout(() => controller.abort(new DOMException("Analysis deadline exceeded", "TimeoutError")), timeoutMs);
      set({ pending: true, phase: "starting", startedAt: Date.now(), result: null });
      let result: AnalysisResult;
      try {
        result = await Promise.race([interrupted, transport(input, {
          signal: controller.signal,
          onProgress: (phase) => { if (request === generation && !controller.signal.aborted) set({ phase }); },
        })]);
      }
      catch { result = { ok: false, code: "provider", message: "The analysis request failed. Please try again." }; }
      finally {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", onAbort);
        if (activeRequest === controller) activeRequest = null;
      }
      const currentDatabase = workspace.getState(), currentAi = ai.getState();
      // Also guard without subscriptions (initial mount, cleanup, or test caller).
      if (request !== generation || currentDatabase.snapshot !== database.snapshot ||
        currentDatabase.connectionString !== database.connectionString || currentDatabase.scopeOverrides !== database.scopeOverrides ||
        currentDatabase.result !== database.result || currentAi.input !== settings.input || get().supportingContext !== supportingContext) {
        if (request === generation) get().invalidate();
        return;
      }
      set({ pending: false, phase: null, startedAt: null, result, ...(result.ok ? {
        model: result.model, selectedPatternId: result.model.accessPatterns[0]?.id ?? null,
      } : {}) });
    },
  }));
}

export function subscribeToAnalysisInputs(
  store: ReturnType<typeof createAnalysisStore>, workspace: StoreApi<WorkspaceState>, ai: StoreApi<AiState>,
) {
  const stopWorkspace = workspace.subscribe((state, previous) => {
    if (state.snapshot !== previous.snapshot || state.connectionString !== previous.connectionString ||
      state.scopeOverrides !== previous.scopeOverrides || state.pending !== previous.pending || state.result !== previous.result) store.getState().invalidate();
  });
  const stopAi = ai.subscribe((state, previous) => {
    if (state.input !== previous.input) store.getState().invalidate();
  });
  return () => { stopWorkspace(); stopAi(); };
}
