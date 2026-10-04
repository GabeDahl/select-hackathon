"use server";

import type { AnalysisResult } from "@/lib/analysis-types";

// Retain a safe response for stale browser bundles. Analysis now exclusively
// uses the cancellable /api/analysis stream instead of a queued Server Action.
export async function analyzeAuthorization(_input: unknown): Promise<AnalysisResult> {
  console.warn("[analysis] Obsolete Server Action called. Reload the browser tab to use POST /api/analysis.");
  return { ok: false, code: "input", message: "This tab is using the old analysis request. Reload the browser tab and retry analysis." };
}
