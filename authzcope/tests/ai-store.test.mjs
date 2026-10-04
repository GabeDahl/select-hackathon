import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiStore } from "../lib/ai-store.ts";

const configuration = { apiKeyConfigured: { openai: false, anthropic: true, google: false } };
const accepted = { ok: true, stage: "settings" };
const verified = { ok: true, stage: "connection" };

test("AI state is isolated per provider instance and clears credentials on provider change", async () => {
  const first = createAiStore(configuration, async () => accepted, async () => verified);
  const second = createAiStore(configuration, async () => accepted, async () => verified);
  assert.equal(first.getState().input.aiModel, "gpt-6.1-sol");
  first.getState().updateInput({ aiModel: "model", aiApiKey: "private-key" });
  await first.getState().checkSettings();
  assert.deepEqual(first.getState().result, accepted);
  assert.equal(second.getState().input.aiApiKey, "");
  first.getState().updateInput({ aiProvider: "anthropic" });
  assert.deepEqual(first.getState().input, { aiProvider: "anthropic", aiModel: "claude-sonnet-5-5", aiApiKey: "" });
  assert.equal(first.getState().result, null);
  first.getState().updateInput({ aiProvider: "google" });
  assert.equal(first.getState().input.aiModel, "gemini-3.8-flash");
  first.getState().updateInput({ aiModel: "custom-model" });
  assert.equal(first.getState().input.aiModel, "custom-model");
  first.getState().updateInput({ aiProvider: "openai" });
  assert.equal(first.getState().input.aiModel, "gpt-6.1-sol");
});

test("a result for old AI settings cannot verify current settings", async () => {
  let resolve;
  let calls = 0;
  const store = createAiStore(configuration, async () => accepted, () => { calls++; return new Promise((r) => { resolve = r; }); });
  store.getState().updateInput({ aiModel: "old-model", aiApiKey: "key" });
  const pending = store.getState().testConnection();
  await store.getState().testConnection();
  assert.equal(calls, 1);
  store.getState().updateInput({ aiModel: "new-model" });
  resolve(verified);
  await pending;
  assert.equal(store.getState().pending, null);
  assert.equal(store.getState().result, null);
});

test("transport failures expose no raw error or credentials", async () => {
  const store = createAiStore(configuration, async () => { throw new Error("private-key"); }, async () => verified);
  store.getState().updateInput({ aiModel: "model", aiApiKey: "private-key" });
  await store.getState().checkSettings();
  assert.equal(store.getState().result.ok, false);
  assert.equal(JSON.stringify(store.getState().result).includes("private-key"), false);
  assert.equal(store.getState().pending, null);
});
