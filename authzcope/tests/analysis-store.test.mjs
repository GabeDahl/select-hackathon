import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "../lib/workspace-store.ts";
import { createAiStore } from "../lib/ai-store.ts";
import { createAnalysisStore, subscribeToAnalysisInputs } from "../lib/analysis-store.ts";
import { analysisFixture, imported } from "./analysis-fixtures.mjs";

const configuration = { apiKeyConfigured: { openai: true, anthropic: false, google: false } };
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
async function setup(transport, timeoutMs) {
  const fixture = analysisFixture();
  const workspace = createWorkspaceStore(true, async () => imported(fixture.snapshot));
  const ai = createAiStore(configuration, async () => ({ ok: true, stage: "settings" }), async () => ({ ok: true, stage: "connection" }));
  await workspace.getState().testConnection();
  const store = createAnalysisStore(workspace, ai, transport ?? (async () => ({ ok: true, model: fixture.model, completedAt: "now" })), timeoutMs);
  const stop = subscribeToAnalysisInputs(store, workspace, ai);
  return { fixture, workspace, ai, store, stop };
}

test("analysis transports the current scope/settings/context, prevents duplicate requests and keeps isolated tab state", async () => {
  const waiting = deferred(), calls = [];
  const { store, fixture, stop } = await setup((input) => { calls.push(input); return waiting.promise; });
  const other = await setup();
  store.getState().updateSupportingContext("Independent intended behavior.");
  const request = store.getState().analyze(); await store.getState().analyze();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshotRevision, fixture.snapshot.revision);
  assert.equal(calls[0].supportingContext, "Independent intended behavior.");
  assert.equal(other.store.getState().pending, false);
  waiting.resolve({ ok: true, model: fixture.model, completedAt: "now" }); await request;
  assert.equal(store.getState().model.modelId, fixture.model.modelId);
  assert.equal(store.getState().selectedPatternId, fixture.model.accessPatterns[0].id);
  assert.equal(other.store.getState().model, null);
  stop(); other.stop();
});

for (const [label, change] of [
  ["database credentials", ({ workspace }) => workspace.getState().updateConnectionString("new")],
  ["scope", ({ workspace, fixture }) => workspace.getState().setObjectIncluded(fixture.snapshot.objects[0].id, false)],
  ["model", ({ ai }) => ai.getState().updateInput({ aiModel: "other-model" })],
  ["provider", ({ ai }) => ai.getState().updateInput({ aiProvider: "google" })],
  ["key", ({ ai }) => ai.getState().updateInput({ aiApiKey: "new" })],
  ["context", ({ store }) => store.getState().updateSupportingContext("new intent")],
  ["snapshot refresh", ({ workspace }) => workspace.getState().testConnection()],
]) test(`changing ${label} clears the model and ignores an older response`, async () => {
  const waiting = deferred(); let calls = 0;
  const setupResult = await setup(async () => { if (++calls === 1) return { ok: true, model: analysisFixture().model, completedAt: "now" }; return waiting.promise; });
  const { store, fixture, stop } = setupResult;
  await store.getState().analyze(); assert.ok(store.getState().model);
  const request = store.getState().analyze(); await change(setupResult);
  assert.equal(store.getState().model, null);
  waiting.resolve({ ok: true, model: fixture.model, completedAt: "now" }); await request;
  assert.equal(store.getState().model, null);
  assert.equal(store.getState().pending, false);
  stop();
});

test("display filters, source selection and AI verification do not invalidate accepted analysis", async () => {
  const { store, workspace, ai, fixture, stop } = await setup();
  await store.getState().analyze();
  workspace.getState().setSchemaFilters({ search: "fixture", kind: "all" });
  workspace.getState().selectObject(fixture.snapshot.objects[0].id);
  await ai.getState().checkSettings();
  assert.equal(store.getState().model.modelId, fixture.model.modelId);
  store.getState().selectPattern(fixture.model.accessPatterns[1].id);
  assert.equal(store.getState().selectedPatternId, fixture.model.accessPatterns[1].id);
  stop();
});

test("cannot analyze absent or failed refresh snapshots; transport failures expose a safe error", async () => {
  const { store, workspace, stop } = await setup(async () => { throw new Error("secret-provider-response"); });
  await store.getState().analyze();
  assert.equal(store.getState().result.ok, false);
  assert.equal(JSON.stringify(store.getState().result).includes("secret"), false);
  workspace.getState().updateConnectionString("new");
  await store.getState().analyze();
  assert.equal(store.getState().result.code, "input");
  stop();
});

test("a stalled transport times out and releases pending even if it ignores cancellation", async () => {
  let signal;
  const { store, stop } = await setup((_input, options) => {
    signal = options.signal;
    options.onProgress("generating_model");
    return new Promise(() => {});
  }, 10);
  const request = store.getState().analyze();
  assert.equal(store.getState().phase, "generating_model");
  assert.equal(typeof store.getState().startedAt, "number");
  await request;
  assert.equal(signal.aborted, true);
  assert.equal(store.getState().pending, false);
  assert.equal(store.getState().result.code, "timeout");
  assert.equal(store.getState().phase, null);
  stop();
});

test("cancellation allows retry and ignores late results and progress from the cancelled request", async () => {
  const waiting = deferred(); let staleOptions, calls = 0;
  const { store, fixture, stop } = await setup((_input, options) => {
    if (++calls === 1) { staleOptions = options; return waiting.promise; }
    return Promise.resolve({ ok: true, model: analysisFixture().model, completedAt: "new" });
  });
  const request = store.getState().analyze();
  store.getState().cancel();
  await request;
  assert.equal(staleOptions.signal.aborted, true);
  assert.equal(store.getState().pending, false);
  assert.equal(store.getState().result.code, "cancelled");
  await store.getState().analyze();
  staleOptions.onProgress("generating_model");
  waiting.resolve({ ok: true, model: fixture.model, completedAt: "old" });
  await waiting.promise;
  assert.equal(store.getState().result.completedAt, "new");
  assert.equal(store.getState().phase, null);
  stop();
});
