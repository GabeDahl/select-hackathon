import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Client } from "pg";
import { generateText, streamText, Output, jsonSchema, APICallError } from "ai";

import { getAiConfigurationStatus, resolveAiSettings, validateAiSettings } from "../lib/ai-connection.ts";
import { createAiCallOptions, testAiConnection, aiErrorResult } from "../lib/ai-service.ts";

const environmentNames = ["AI_API_KEY", "AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "DATABASE_URL"];
const originalEnvironment = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of environmentNames) delete process.env[name];
});

test("provider keys stay separate and configuration exposes only presence", () => {
  process.env.OPENAI_API_KEY = "openai-secret";
  process.env.ANTHROPIC_API_KEY = "anthropic-secret";
  assert.deepEqual(getAiConfigurationStatus(), { apiKeyConfigured: { openai: true, anthropic: true, google: false } });
  assert.equal(resolveAiSettings({ aiProvider: "anthropic", aiModel: "model", aiApiKey: "input-secret" }).settings.apiKey, "anthropic-secret");
  assert.equal(resolveAiSettings({ aiProvider: "google", aiModel: "model" }).ok, false);
  assert.equal(JSON.stringify(getAiConfigurationStatus()).includes("secret"), false);
});

test("generic environment key is scoped to its configured provider", () => {
  process.env.AI_API_KEY = "generic-secret";
  assert.deepEqual(getAiConfigurationStatus(), { apiKeyConfigured: { openai: true, anthropic: false, google: false } });
  process.env.AI_PROVIDER = "google";
  assert.deepEqual(getAiConfigurationStatus(), { apiKeyConfigured: { openai: false, anthropic: false, google: true } });
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "specific-secret";
  assert.equal(resolveAiSettings({ aiProvider: "google", aiModel: "model" }).settings.apiKey, "specific-secret");
  process.env.AI_PROVIDER = "invalid";
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  assert.deepEqual(getAiConfigurationStatus(), { apiKeyConfigured: { openai: false, anthropic: false, google: false } });
});

function providerResponse(provider, text = "OK") {
  if (provider === "openai") return {
    id: "response-1", model: "chosen-model", created_at: 1,
    output: [{ type: "message", role: "assistant", id: "message-1", content: [{ type: "output_text", text, annotations: [] }] }],
    usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
  };
  if (provider === "anthropic") return {
    type: "message", id: "message-1", model: "chosen-model",
    content: [{ type: "text", text }], stop_reason: "end_turn",
    usage: { input_tokens: 5, output_tokens: 2 },
  };
  return {
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
  };
}

for (const [provider, host, authHeader] of [
  ["openai", "api.openai.com", "authorization"],
  ["anthropic", "api.anthropic.com", "x-api-key"],
  ["google", "generativelanguage.googleapis.com", "x-goog-api-key"],
]) {
  test(`${provider} uses its direct adapter, arbitrary model ID, supplied key, and normalized SDK result`, async () => {
    const requests = [];
    mock.method(Client.prototype, "connect", () => { throw new Error("Unexpected database request"); });
    mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(new URL(url).hostname, host);
      const headers = new Headers(init.headers);
      assert.equal(headers.get(authHeader), provider === "openai" ? "Bearer private-api-key" : "private-api-key");
      requests.push(JSON.parse(init.body));
      return Response.json(providerResponse(provider));
    });
    const options = createAiCallOptions({ aiProvider: provider, aiModel: "chosen-model", aiApiKey: "private-api-key" });
    const result = await generateText({ ...options, prompt: "Caller-owned prompt.", maxOutputTokens: 128 });
    assert.equal(result.text, "OK");
    assert.equal(result.usage.inputTokens, 5);
    assert.equal(result.usage.outputTokens, 2);
    assert.equal(result.finishReason, "stop");
    assert.equal(requests.length, 1);
    assert.ok(JSON.stringify(requests[0]).includes("Caller-owned prompt."));
    assert.equal(JSON.stringify(requests[0]).includes("private-api-key"), false);
    if (provider === "openai") assert.equal(requests[0].store, false);
    assert.equal(options.timeout, 60_000);
    assert.equal(options.maxRetries, 2);
    assert.equal(options.experimental_telemetry.isEnabled, false);
  });
}

test("explicit connection check generates a bounded request and returns no provider data", async () => {
  mock.method(globalThis, "fetch", async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.equal(request.max_output_tokens, 128);
    assert.ok(JSON.stringify(request).includes("Reply with OK."));
    return Response.json(providerResponse("openai", "provider-sensitive-response"));
  });
  assert.deepEqual(await testAiConnection({ aiProvider: "openai", aiModel: "chosen-model", aiApiKey: "key" }), { ok: true, stage: "connection" });
});

test("transport diagnostics identify the HTTP boundary and credential source without sensitive contents", async () => {
  process.env.OPENAI_API_KEY = "environment-secret";
  const events = [];
  mock.method(globalThis, "fetch", async () => Response.json(providerResponse("openai", "private-response"), {
    headers: { "x-request-id": "req_example" },
  }));
  const options = createAiCallOptions({ aiProvider: "openai", aiModel: "chosen-model", aiApiKey: "input-secret" }, (event) => events.push(event));
  await generateText({ ...options, prompt: "private-prompt" });
  assert.deepEqual(events, [
    { stage: "configured", provider: "openai", credentialSource: "environment" },
    { stage: "http_request_sent", provider: "openai" },
    { stage: "http_response_headers", provider: "openai", status: 200, requestId: "req_example" },
  ]);
  assert.equal(/secret|private/.test(JSON.stringify(events)), false);
});

test("invalid settings stop before any provider request", async () => {
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  const result = await testAiConnection({ aiProvider: "invalid", aiModel: "model", aiApiKey: "key" });
  assert.equal(result.ok, false);
  assert.ok(result.fieldErrors.aiProvider);
  assert.equal(fetch.mock.callCount(), 0);
});

test("connection errors are actionable, redacted, and never retried", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({
    error: { message: "sensitive-key-and-prompt", type: "invalid_request_error", code: "invalid_api_key" },
  }, { status: 401 }));
  const result = await testAiConnection({ aiProvider: "openai", aiModel: "model", aiApiKey: "sensitive-key-and-prompt" });
  assert.equal(result.ok, false);
  assert.match(result.message, /credentials/);
  assert.equal(JSON.stringify(result).includes("sensitive-key-and-prompt"), false);
  assert.equal(fetch.mock.callCount(), 1);
  for (const [statusCode, message] of [[429, /quota/], [404, /model/], [500, /failed/]]) {
    const error = new APICallError({ message: "secret", url: "https://provider.invalid", requestBodyValues: { secret: "secret" }, statusCode });
    const safe = aiErrorResult(error);
    assert.match(safe.message, message);
    assert.equal(JSON.stringify(safe).includes("secret"), false);
  }
});

test("request rejections distinguish schema, context, model and settings without echoing provider details", () => {
  for (const [detail, expected] of [
    [{ code: "invalid_json_schema", message: "private-key-and-prompt" }, /structured-output schema/],
    [{ param: "text.format.schema", message: "private-key-and-prompt" }, /structured-output schema/],
    [{ message: "Invalid schema for response format: private-key-and-prompt" }, /structured-output schema/],
    [{ code: "context_length_exceeded", message: "private-key-and-prompt" }, /context limit/],
    [{ code: "model_not_found", message: "private-key-and-prompt" }, /selected model/],
    [{ param: "max_output_tokens", message: "private-key-and-prompt" }, /setting max_output_tokens/],
    [{ param: "private-key-and-prompt", code: "private-key-and-prompt", message: "private-key-and-prompt" }, /HTTP 400/],
  ]) {
    const error = new APICallError({
      message: "private-key-and-prompt", url: "https://provider.invalid",
      requestBodyValues: { secret: "private-key-and-prompt" }, statusCode: 400,
      data: { error: detail },
    });
    const result = aiErrorResult(error);
    assert.match(result.message, expected);
    assert.equal(JSON.stringify(result).includes("private-key-and-prompt"), false);
  }
});

test("generation honors caller cancellation and an overridden timeout", async () => {
  mock.method(globalThis, "fetch", async (_url, init) => new Promise((_resolve, reject) => {
    if (init.signal.aborted) reject(init.signal.reason);
    else init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  }));
  const options = createAiCallOptions({ aiProvider: "google", aiModel: "model", aiApiKey: "key" });
  const controller = new AbortController();
  const pending = generateText({ ...options, prompt: "test", abortSignal: controller.signal, maxRetries: 0 });
  controller.abort();
  await assert.rejects(pending);
  await assert.rejects(generateText({ ...options, prompt: "test", timeout: 20, maxRetries: 0 }));
});

test("the same options support streaming without assembling context", async () => {
  mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(JSON.parse(init.body).contents[0].parts[0].text, "Caller-owned prompt.");
    const chunks = ["O", "K"].map((text) => `data: ${JSON.stringify(providerResponse("google", text))}\n\n`).join("");
    return new Response(chunks, { headers: { "content-type": "text/event-stream" } });
  });
  const result = streamText({ ...createAiCallOptions({ aiProvider: "google", aiModel: "model", aiApiKey: "key" }), prompt: "Caller-owned prompt." });
  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  assert.equal(text, "OK");
  assert.equal(await result.finishReason, "stop");
});

test("stream errors remain inspectable and default logs redact provider details", async () => {
  const log = mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => Response.json({
    error: { message: "private-key-and-prompt", code: 401, status: "UNAUTHENTICATED" },
  }, { status: 401 }));
  const result = streamText({
    ...createAiCallOptions({ aiProvider: "google", aiModel: "model", aiApiKey: "key" }),
    prompt: "private-key-and-prompt", maxRetries: 0,
  });
  const errors = [];
  for await (const chunk of result.fullStream) {
    if (chunk.type === "error") errors.push(aiErrorResult(chunk.error));
  }
  assert.ok(errors.length > 0);
  assert.equal(JSON.stringify(errors).includes("private-key-and-prompt"), false);
  assert.ok(log.mock.callCount() > 0);
  assert.equal(JSON.stringify(log.mock.calls.map((call) => call.arguments)).includes("private-key-and-prompt"), false);
});

test("callers can choose their own structured output schema", async () => {
  mock.method(globalThis, "fetch", async () => Response.json(providerResponse("google", '{"answer":"OK"}')));
  const result = await generateText({
    ...createAiCallOptions({ aiProvider: "google", aiModel: "model", aiApiKey: "key" }),
    prompt: "Caller-owned prompt.",
    output: Output.object({ schema: jsonSchema({ type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false }) }),
  });
  assert.deepEqual(result.output, { answer: "OK" });
});

afterEach(() => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("AI settings are accepted without a database or provider request", () => {
  const connect = mock.method(Client.prototype, "connect", () => {
    throw new Error("Unexpected database request");
  });
  const fetch = mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected provider request");
  });
  const input = { aiProvider: "openai", aiModel: "chosen-model", aiApiKey: "private-api-key" };
  assert.deepEqual(validateAiSettings(input), { ok: true, stage: "settings" });
  process.env.DATABASE_URL = "invalid";
  assert.deepEqual(validateAiSettings(input), { ok: true, stage: "settings" });
  assert.equal(connect.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test("validates missing, malformed, and oversized AI settings", () => {
  assert.deepEqual(Object.keys(validateAiSettings(null).fieldErrors).sort(), ["aiApiKey", "aiModel", "aiProvider"]);
  for (const input of [
    { aiProvider: "unsupported", aiModel: "model", aiApiKey: "key" },
    { aiProvider: "openai", aiModel: "model\n", aiApiKey: "key\nunsafe" },
    { aiProvider: "openai", aiModel: 123, aiApiKey: "key" },
    { aiProvider: "openai", aiModel: "model", aiApiKey: {} },
    { aiProvider: "openai", aiModel: " ", aiApiKey: "key" },
    { aiProvider: "openai", aiModel: "x".repeat(201), aiApiKey: "key" },
    { aiProvider: "openai", aiModel: "model", aiApiKey: "x".repeat(8193) },
  ]) {
    assert.equal(validateAiSettings(input).ok, false);
  }
});

test("server AI key takes precedence and is never returned", () => {
  process.env.AI_API_KEY = "server-ai-secret";
  assert.deepEqual(validateAiSettings({ aiProvider: "openai", aiModel: "model", aiApiKey: "x".repeat(8193) }), { ok: true, stage: "settings" });
  process.env.AI_API_KEY = "x".repeat(8193);
  const result = validateAiSettings({ aiProvider: "openai", aiModel: "model", aiApiKey: "valid-input-key" });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes(process.env.AI_API_KEY), false);
});
