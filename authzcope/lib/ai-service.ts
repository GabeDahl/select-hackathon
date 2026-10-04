import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, generateText, RetryError, type LanguageModel } from "ai";

import { resolveAiSettings } from "./ai-connection.ts";
import type { AiConnectionInput, AiConnectionResult, AiProvider } from "./ai-connection-types.ts";

export type AiTransportEvent =
  | { stage: "configured"; provider: AiProvider; credentialSource: "environment" | "input" }
  | { stage: "http_request_sent" | "http_request_failed" | "http_headers_timeout"; provider: AiProvider }
  | { stage: "http_response_headers"; provider: AiProvider; status: number; requestId: string | null };

export class AiConfigurationError extends Error {
  readonly result: Extract<AiConnectionResult, { ok: false }>;
  constructor(result: Extract<AiConnectionResult, { ok: false }>) {
    super(result.message);
    this.name = "AiConfigurationError";
    this.result = result;
  }
}

/** Request-scoped SDK options. Callers supply their own prompt/messages/output/tools.
 * Use with either generateText or streamText; retain the SDK's types and results.
 * No mutable global provider, credential cache, database access, or prompt assembly.
 */
export function createAiCallOptions(input: AiConnectionInput, onTransportEvent?: (event: AiTransportEvent) => void) {
  const resolved = resolveAiSettings(input);
  if (!resolved.ok) throw new AiConfigurationError(resolved);
  const { provider, modelId, apiKey, credentialSource } = resolved.settings;
  onTransportEvent?.({ stage: "configured", provider, credentialSource });
  // Request-scoped instrumentation at the actual adapter HTTP boundary. It
  // never observes credentials, body contents, or provider response contents.
  const transportFetch: typeof globalThis.fetch | undefined = onTransportEvent ? async (url, init) => {
    onTransportEvent({ stage: "http_request_sent", provider });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      onTransportEvent({ stage: "http_headers_timeout", provider });
      controller.abort(new DOMException("Provider response headers timed out", "TimeoutError"));
    }, 45_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    try {
      const response = await globalThis.fetch(url, { ...init, signal, cache: "no-store" });
      const id = response.headers.get("x-request-id") ?? response.headers.get("request-id");
      const requestId = id && /^req_[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
      onTransportEvent({ stage: "http_response_headers", provider, status: response.status, requestId });
      return response;
    } catch (error) {
      onTransportEvent({ stage: "http_request_failed", provider });
      throw error;
    } finally { clearTimeout(timer); }
  } : undefined;
  let model: LanguageModel;
  switch (provider) {
    case "openai": model = createOpenAI({ apiKey, fetch: transportFetch }).responses(modelId); break;
    case "anthropic": model = createAnthropic({ apiKey, fetch: transportFetch }).languageModel(modelId); break;
    case "google": model = createGoogleGenerativeAI({ apiKey, fetch: transportFetch }).languageModel(modelId); break;
  }
  const providerOptions: NonNullable<Parameters<typeof generateText>[0]["providerOptions"]> =
    provider === "openai" ? { openai: { store: false } } : {};
  return {
    model,
    maxRetries: 2,
    timeout: 60_000,
    // OpenAI Responses defaults to storing response state; opt out explicitly.
    providerOptions,
    experimental_telemetry: { isEnabled: false },
    // streamText otherwise logs raw errors. Keep its callback behavior, redact
    // default logs, and let callers supply their own safe onError handler.
    onError: ({ error }: { error: unknown }) => { console.error(aiErrorResult(error).message); },
  };
}

/** Safe messages for request boundaries. Raw SDK errors may contain request data. */
export function aiErrorResult(error: unknown): Extract<AiConnectionResult, { ok: false }> {
  if (error instanceof AiConfigurationError) return error.result;
  if (RetryError.isInstance(error)) return aiErrorResult(error.lastError);
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
    return { ok: false, message: "The AI request timed out or was cancelled. Please try again." };
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { ok: false, message: "The provider rejected the credentials or model access. Check your key and permissions." };
    }
    if (error.statusCode === 429) {
      return { ok: false, message: "The provider's rate or quota limit was reached. Check your quota or try again later." };
    }
    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 422) {
      const data = error.data;
      const detail = data && typeof data === "object" && "error" in data ? data.error : null;
      const fields = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
      // Inspect provider details only to select application-owned messages. Never
      // return their free-form message, response body, or unknown code/parameter.
      const code = fields.code;
      const param = fields.param;
      const message = typeof fields.message === "string" ? fields.message : "";
      if (code === "invalid_json_schema" || param === "text.format.schema" ||
        /invalid schema|invalid json schema/i.test(message)) {
        return { ok: false, message: "The provider rejected the structured-output schema. The application's schema needs correction." };
      }
      if (code === "context_length_exceeded" || /context length|context window|too many tokens/i.test(message)) {
        return { ok: false, message: "The analysis exceeds the model's context limit. Narrow the imported schema scope and try again." };
      }
      if (code === "model_not_found" || param === "model" || error.statusCode === 404) {
        return { ok: false, message: "The provider could not use the selected model. Check the model identifier and your account's model access." };
      }
      const settings = ["max_output_tokens", "max_tokens", "temperature", "top_p", "reasoning.effort", "text.format", "response_format"];
      if (typeof param === "string" && settings.includes(param)) {
        return { ok: false, message: `The provider rejected the request setting ${param}. The application needs to use a setting supported by this model.` };
      }
      return { ok: false, message: `The provider rejected the request (HTTP ${error.statusCode}). It did not identify a recognized model, schema, or setting error.` };
    }
  }
  return { ok: false, message: "The AI provider request failed. Please try again." };
}

/** Explicit, small connection check. Sends no database or application evidence. */
export async function testAiConnection(input: AiConnectionInput): Promise<AiConnectionResult> {
  try {
    const result = await generateText({
      ...createAiCallOptions(input),
      prompt: "Reply with OK.",
      maxOutputTokens: 128,
      maxRetries: 0,
      timeout: 15_000,
    });
    if (!result.text.trim()) {
      return { ok: false, message: "The model returned no text. Try a text model or check its settings." };
    }
    return { ok: true, stage: "connection" };
  } catch (error) {
    return aiErrorResult(error);
  }
}
