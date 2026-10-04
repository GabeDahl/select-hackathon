import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { requestAuthorizationAnalysis } from "../lib/analysis-transport.ts";
import { analysisFixture } from "./analysis-fixtures.mjs";

afterEach(() => mock.restoreAll());

test("analysis transport reconstructs split UTF-8 events and delivers progress before the final model", async () => {
  const { input, model } = analysisFixture();
  const result = { ok: true, model: { ...model, entityTypes: model.entityTypes.map((entity, index) => index === 0 ? { ...entity, label: "Café" } : entity) }, completedAt: "now" };
  const bytes = new TextEncoder().encode([
    { type: "progress", phase: "checking_schema" },
    { type: "progress", phase: "generating_model" },
    { type: "result", result },
  ].map((event) => JSON.stringify(event)).join("\n"));
  const signal = new AbortController().signal;
  mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "/api/analysis");
    assert.equal(init.signal, signal);
    assert.deepEqual(JSON.parse(init.body), input);
    return new Response(new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }));
  });
  const phases = [];
  assert.deepEqual(await requestAuthorizationAnalysis(input, { signal, onProgress: (phase) => phases.push(phase) }), result);
  assert.deepEqual(phases, ["checking_schema", "generating_model"]);
});

test("a truncated response fails rather than leaving analysis pending", async () => {
  mock.method(globalThis, "fetch", async () => new Response('{"type":"progress","phase":"generating_model"}\n'));
  await assert.rejects(requestAuthorizationAnalysis(analysisFixture().input, {
    signal: new AbortController().signal, onProgress() {},
  }), /without a result/);
});
