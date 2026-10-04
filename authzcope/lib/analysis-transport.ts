import { ANALYSIS_PHASES, type AnalysisEvent, type AnalysisInput, type AnalysisRequestOptions, type AnalysisResult } from "./analysis-types.ts";

/** Browser transport. Only status and the final validated result are streamed;
 * provider text/reasoning and request credentials never become progress events.
 */
export async function requestAuthorizationAnalysis(input: AnalysisInput, options: AnalysisRequestOptions): Promise<AnalysisResult> {
  const response = await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Authzcope-Analysis": "1" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: options.signal,
  });
  if (!response.ok || !response.body) throw new Error("Analysis transport failed.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  function consume(line: string): AnalysisResult | undefined {
    const event = JSON.parse(line) as AnalysisEvent;
    if (event.type === "progress" && ANALYSIS_PHASES.includes(event.phase)) options.onProgress(event.phase);
    if (event.type === "result" && typeof event.result?.ok === "boolean") return event.result;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (line.trim()) {
          const result = consume(line);
          if (result) return result;
        }
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const result = consume(buffer);
      if (result) return result;
    }
    throw new Error("Analysis ended without a result.");
  } finally {
    // Cancel rather than just releasing the lock so interrupted work is stopped.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
