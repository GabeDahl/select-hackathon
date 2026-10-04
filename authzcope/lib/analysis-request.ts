import type { AnalysisPhase, AnalysisResult } from "./analysis-types.ts";

// The server bounds the whole pipeline, including introspection. The browser
// allows a little extra time for delivery and also handles a stalled connection.
export const ANALYSIS_TIMEOUT_MS = 150_000;
export const ANALYSIS_CLIENT_TIMEOUT_MS = ANALYSIS_TIMEOUT_MS + 10_000;

const timeoutStages: Record<AnalysisPhase, string> = {
  starting: "starting the request",
  checking_schema: "checking the database schema",
  preparing_evidence: "preparing evidence",
  generating_model: "waiting for the authorization model",
  receiving_model: "receiving the authorization model",
  validating_model: "validating the authorization model",
};

export function interruptedAnalysisResult(signal: AbortSignal, phase: AnalysisPhase = "starting"): Extract<AnalysisResult, { ok: false }> {
  return signal.reason?.name === "TimeoutError"
    ? { ok: false, code: "timeout", message: `Analysis timed out while ${timeoutStages[phase]}. Try again or narrow the imported schema scope.` }
    : { ok: false, code: "cancelled", message: "Analysis cancelled." };
}
