import { runAuthorizationAnalysis } from "@/lib/analysis-service";
import type { AnalysisEvent } from "@/lib/analysis-types";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  console.info("[analysis] POST /api/analysis received");
  // Keep the same-origin boundary previously provided by Server Actions.
  const origin = request.headers.get("origin");
  if (request.headers.get("x-authzcope-analysis") !== "1" ||
    (origin && origin !== new URL(request.url).origin)) {
    return Response.json({ ok: false, code: "input", message: "Open Authzcope to start analysis." }, { status: 403 });
  }
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ ok: false, code: "input", message: "Check the analysis settings." }, { status: 400 }); }

  const abortController = new AbortController();
  const abort = () => abortController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AnalysisEvent) => {
        if (closed || abortController.signal.aborted) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
        catch { closed = true; abort(); }
      };
      void runAuthorizationAnalysis(input, undefined, {
        signal: abortController.signal,
        onProgress: (phase) => send({ type: "progress", phase }),
      }).then((result) => send({ type: "result", result })).catch(() => {
        send({ type: "result", result: { ok: false, code: "provider", message: "The analysis request failed. Please try again." } });
      }).finally(() => {
        request.signal.removeEventListener("abort", abort);
        if (!closed) { closed = true; controller.close(); }
      });
    },
    cancel() {
      closed = true;
      abort();
      request.signal.removeEventListener("abort", abort);
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
