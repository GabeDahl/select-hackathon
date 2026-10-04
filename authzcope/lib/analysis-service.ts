import "server-only";

import { randomUUID } from "node:crypto";
import { streamText, NoObjectGeneratedError, Output } from "ai";
import { runIntrospection } from "./introspection.ts";
import { aiErrorResult, createAiCallOptions } from "./ai-service.ts";
import { AnalysisInputError, prepareAnalysis, validateAnalysisInput } from "./analysis-input.ts";
import { AnalysisValidationError, validateAuthorizationModel } from "./analysis-validation.ts";
import { compactAnalysisOutputSchema } from "./analysis-authoring.ts";
import { authorizationAnalysisInstructions } from "./analysis-prompt.ts";
import { ANALYSIS_TIMEOUT_MS, interruptedAnalysisResult } from "./analysis-request.ts";
import type { AnalysisPhase, AnalysisRequestOptions, AnalysisResult } from "./analysis-types.ts";

function validationCause(error: unknown): AnalysisValidationError | null {
  const seen = new Set<unknown>();
  for (let depth = 0; error && typeof error === "object" && depth < 8 && !seen.has(error); depth++) {
    if (error instanceof AnalysisValidationError) return error;
    seen.add(error);
    error = "cause" in error ? error.cause : undefined;
  }
  return null;
}

export async function runAuthorizationAnalysis(
  value: unknown, inspect = runIntrospection, options: Partial<AnalysisRequestOptions> = {},
): Promise<AnalysisResult> {
  const requestId = randomUUID().slice(0, 8), startedAt = Date.now();
  const log = (stage: string) => console.info(`[analysis ${requestId}] +${Date.now() - startedAt}ms ${stage}`);
  log("request started");
  const controller = new AbortController();
  let phase: AnalysisPhase = "starting";
  const interrupted = new Promise<AnalysisResult>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(interruptedAnalysisResult(controller.signal, phase)), { once: true });
  });
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException("Analysis deadline exceeded", "TimeoutError")), ANALYSIS_TIMEOUT_MS);
  try {
    const result = await Promise.race([interrupted, performAuthorizationAnalysis(value, inspect, {
      signal: controller.signal,
      onProgress: (nextPhase) => {
        if (!controller.signal.aborted) {
          phase = nextPhase;
          log(nextPhase);
          options.onProgress?.(nextPhase);
        }
      },
    }, log)]);
    // Only application-owned stages and result codes. Never log request data,
    // provider errors, SQL, credentials, or generated model contents.
    log(result.ok ? "completed" : `failed: ${result.code}`);
    return result;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function performAuthorizationAnalysis(
  value: unknown, inspect: typeof runIntrospection, request: AnalysisRequestOptions,
  log: (stage: string) => void,
): Promise<AnalysisResult> {
  let headersTimedOut = false;
  try {
    request.signal.throwIfAborted();
    const input = validateAnalysisInput(value);
    const options = createAiCallOptions(input.ai, (event) => {
      if (request.signal.aborted) return;
      if (event.stage === "http_headers_timeout") headersTimedOut = true;
      if (event.stage === "configured") log(`provider=${event.provider} credential_source=${event.credentialSource}`);
      else if (event.stage === "http_response_headers") log(`http_response_headers status=${event.status}${event.requestId ? ` request_id=${event.requestId}` : ""}`);
      else log(event.stage);
    });
    // Recollect on the server rather than trusting a browser-supplied snapshot.
    request.onProgress("checking_schema");
    const result = await inspect(input.database);
    request.signal.throwIfAborted();
    if (!result.ok) return { ok: false, code: "database", message: result.message };
    if (result.snapshot.revision !== input.snapshotRevision) {
      return { ok: false, code: "stale_snapshot", message: "The database schema changed after import. Refresh the schema, review its scope, and analyze again." };
    }
    request.onProgress("preparing_evidence");
    const prepared = prepareAnalysis(result.snapshot, input.scopeOverrides, input.supportingContext);
    request.signal.throwIfAborted();
    const schema = compactAnalysisOutputSchema(prepared);
    // Resolve the format before entering the SDK, so schema preparation cannot
    // be mistaken for an HTTP request or a slow provider response.
    const output = Output.object({
      name: "authorization_model",
      description: "Compact evidence-backed authorization semantics. The server compiles the visualization model.",
      schema,
    });
    await output.responseFormat;
    log(`output_schema_ready evidence_characters=${prepared.payload.length} schema_characters=${JSON.stringify(schema.jsonSchema).length} instruction_characters=${authorizationAnalysisInstructions.length}`);
    request.onProgress("generating_model");
    const response = streamText({
      ...options,
      providerOptions: input.ai.aiProvider === "openai" ? { ...options.providerOptions, openai: { ...options.providerOptions.openai, reasoningEffort: "low", reasoningSummary: null } } : options.providerOptions,
      abortSignal: request.signal,
      system: authorizationAnalysisInstructions,
      prompt: prepared.payload,
      output,
      onStart: () => log("sdk_generation_started"),
      onLanguageModelCallStart: () => log("sdk_model_call_started"),
      maxOutputTokens: 4_096,
      timeout: 120_000,
      maxRetries: 0,
    });
    let receivedCharacters = 0, lastReport = 0;
    for await (const chunk of response.fullStream) {
      request.signal.throwIfAborted();
      if (chunk.type === "error") throw chunk.error;
      if (chunk.type === "finish") {
        log(`provider_finish reason=${chunk.finishReason} input_tokens=${chunk.totalUsage.inputTokens ?? "unknown"} output_tokens=${chunk.totalUsage.outputTokens ?? "unknown"} reasoning_tokens=${chunk.totalUsage.outputTokenDetails.reasoningTokens ?? "unknown"}`);
      }
      if (chunk.type === "text-delta" || chunk.type === "tool-input-delta") {
        const length = (chunk.type === "text-delta" ? chunk.text : chunk.delta).length;
        if (length === 0) continue;
        if (receivedCharacters === 0) request.onProgress("receiving_model");
        receivedCharacters += length;
        if (lastReport === 0 || Date.now() - lastReport >= 1_000) {
          log(`output_received characters=${receivedCharacters}`);
          lastReport = Date.now();
        }
      }
    }
    log(`provider_stream_finished output_characters=${receivedCharacters}`);
    request.signal.throwIfAborted();
    request.onProgress("validating_model");
    const model = validateAuthorizationModel(await response.output, prepared);
    // The browser already has the catalog snapshot. Do not send hundreds of
    // infrastructure omission names back as part of the semantic model.
    return { ok: true, model: { ...model, coverage: { ...model.coverage, exclusions: [] } }, completedAt: new Date().toISOString() };
  } catch (error) {
    if (request.signal.aborted) return interruptedAnalysisResult(request.signal);
    if (headersTimedOut) return { ok: false, code: "timeout", message: "The AI provider did not return response headers within 45 seconds. Check the server's connection to the provider and try again." };
    if (error instanceof AnalysisInputError) return { ok: false, code: "input", message: error.message };
    const validation = validationCause(error);
    if (validation) {
      log(`validation_failed issues=${JSON.stringify(validation.issues)}`);
      return { ok: false, code: "invalid_output", message: validation.message, issues: validation.issues };
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      // SDK errors contain the original response. Report metadata, never text.
      const reason = error.finishReason ?? "unknown";
      log(`output_parse_failed finish_reason=${reason} output_tokens=${error.usage?.outputTokens ?? "unknown"} reasoning_tokens=${error.usage?.outputTokenDetails.reasoningTokens ?? "unknown"}`);
      return { ok: false, code: "invalid_output", message: reason === "length"
        ? "The AI response exhausted its output token budget before completing the authorization JSON. No partial model was accepted."
        : reason === "content-filter" ? "The AI provider filtered the response. No authorization model was accepted."
        : "The AI response could not be parsed as authorization JSON. No model was accepted." };
    }
    return { ok: false, code: "provider", message: aiErrorResult(error).message };
  }
}
