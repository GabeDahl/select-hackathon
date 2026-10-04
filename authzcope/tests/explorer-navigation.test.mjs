import assert from "node:assert/strict";
import { test } from "node:test";
import { applyNavigationBatch, createModelNavigationRegistry, initialExplorerNavigation } from "../lib/explorer-navigation.ts";
import { testNavigationRegistry as fixtureRegistry } from "./explorer-navigation-fixture.mjs";
import { createExplorerStore } from "../lib/explorer-store.ts";
import { validateExplorerChatReply } from "../lib/explorer-chat-validation.ts";
import { analysisFixture } from "./analysis-fixtures.mjs";

const target = (kind, id) => ({ kind, id });
const batch = (commands, registry = fixtureRegistry) => ({ revision: registry.revision, commands });
const reply = (commands = [{ type: "focus", target: target("selector", "test:launch-brief") }]) => ({ ...batch(commands), answer: "In this illustrative fixture, the project editor path remains.", claimIds: [] });
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
const makeStore = (transport = async () => ({ ok: true, reply: reply() })) => createExplorerStore(fixtureRegistry, () => { const fixture = analysisFixture(); return { mode: "analysis", analysis: fixture.input, model: fixture.model }; }, transport);

test("focus, path highlights, perspective and comparison use shared semantic IDs without geometry", () => {
  const focused = applyNavigationBatch(fixtureRegistry, initialExplorerNavigation, batch([
    { type: "focus", target: target("selector", "test:launch-brief") },
    { type: "highlight", targets: [target("path", "test:project-path:out")] },
  ]));
  assert.equal(focused.ok, true);
  assert.equal(focused.navigation.patternId, "test:read");
  assert.equal(focused.navigation.view, "focus");
  assert.equal(focused.navigation.highlighted[0].id, "test:project-path:out");
  const comparison = applyNavigationBatch(fixtureRegistry, focused.navigation, batch([
    { type: "compare", patternId: "test:read", scenarioIds: ["test:current", "test:share-revoked"] },
  ]));
  assert.equal(comparison.navigation.perspective, "resource");
  assert.equal(comparison.navigation.view, "compare");
  assert.equal(comparison.navigation.focus.id, "test:launch-brief");
  const reset = applyNavigationBatch(fixtureRegistry, comparison.navigation, batch([{ type: "overview" }]));
  assert.equal(reset.navigation.focus, null);
  assert.deepEqual(reset.navigation.scenarioIds, []);
  assert.equal(reset.navigation.view, "overview");
  assert.equal(reset.navigation.perspective, "user");
  assert.equal(JSON.stringify(comparison).includes("position"), false);
});

test("batches are atomic and reject unknown IDs, extra instructions, stale revisions and unscoped scenarios", () => {
  const before = structuredClone(initialExplorerNavigation);
  for (const command of [
    { type: "focus", target: target("selector", "invented") },
    { type: "focus", target: { kind: "selector", id: "test:launch-brief", position: [0, 0, 0] } },
    { type: "overview", sql: "DELETE FROM documents" },
    { type: "run_sql", sql: "SELECT 1" },
    { type: "compare", patternId: "test:read", scenarioIds: ["scenario:invented"] },
    { type: "compare", patternId: "test:read", scenarioIds: ["test:current", "test:current"] },
    { type: "compare", patternId: "test:read", scenarioIds: [] },
  ]) {
    const result = applyNavigationBatch(fixtureRegistry, before, batch([{ type: "perspective", perspective: "resource" }, command]));
    assert.equal(result.ok, false);
    assert.deepEqual(before, initialExplorerNavigation);
  }
  assert.equal(applyNavigationBatch(fixtureRegistry, before, { revision: "old", commands: [] }).ok, false);
  assert.equal(applyNavigationBatch(fixtureRegistry, before, batch(Array.from({ length: 9 }, () => ({ type: "overview" })))).ok, false);
});

test("model adapter preserves arbitrary domain labels and scopes paths, rules and conditions to their actions", () => {
  const { model } = analysisFixture();
  model.entityTypes[0].label = "Laboratory specimen";
  // A known scenario outside this action's scenario space must still be rejected.
  model.scenarios.push({ ...model.scenarios[0], id: "scenario:other-context" });
  const registry = createModelNavigationRegistry(model);
  assert.equal(registry.entries.find((entry) => entry.target.id === model.entityTypes[0].id).label, "Laboratory specimen");
  const pattern = model.accessPatterns[0];
  const focus = { type: "focus", target: target("pattern", pattern.id) };
  const result = applyNavigationBatch(registry, initialExplorerNavigation, batch([focus], registry));
  assert.equal(result.navigation.patternId, pattern.id);
  const scenarios = registry.patterns.find((item) => item.id === pattern.id).scenarioIds;
  assert.ok(scenarios.length);
  assert.equal(applyNavigationBatch(registry, result.navigation, batch([{ type: "compare", patternId: pattern.id, scenarioIds: scenarios.slice(0, 2) }], registry)).ok, true);
  const unrelated = model.accessPaths.find((path) => !pattern.pathIds.includes(path.id));
  assert.equal(applyNavigationBatch(registry, result.navigation, batch([{ type: "highlight", targets: [target("path", unrelated.id)] }], registry)).ok, false);
  const other = model.scenarios.find((scenario) => !scenarios.includes(scenario.id));
  assert.equal(applyNavigationBatch(registry, result.navigation, batch([{ type: "compare", patternId: pattern.id, scenarioIds: [other.id] }], registry)).ok, false);
});

test("reply validation rejects unknown claim references and malformed output without accepting commands", () => {
  assert.deepEqual(validateExplorerChatReply(reply(), fixtureRegistry, initialExplorerNavigation, []), reply());
  for (const changes of [{ claimIds: ["claim:invented"] }, { answer: " " }, { answer: "x".repeat(8_001) }, { extra: true }, { commands: [{ type: "focus", target: target("selector", "invented") }] }]) {
    assert.throws(() => validateExplorerChatReply({ ...reply(), ...changes }, fixtureRegistry, initialExplorerNavigation, []));
  }
});

test("inspecting a rule preserves its action and a scenario focus selects only an unambiguous pattern", () => {
  const focused = applyNavigationBatch(fixtureRegistry, initialExplorerNavigation, batch([{ type: "inspect", target: target("path", "test:project-path:out") }]));
  assert.equal(focused.navigation.patternId, "test:read");
  assert.deepEqual(focused.navigation.highlighted, [target("path", "test:project-path:out")]);
  assert.equal(focused.navigation.perspective, "resource");
  const scenario = applyNavigationBatch(fixtureRegistry, initialExplorerNavigation, batch([{ type: "focus", target: target("scenario", "test:share-revoked") }]));
  assert.deepEqual(scenario.navigation.scenarioIds, ["test:share-revoked"]);
  const { model } = analysisFixture(), registry = createModelNavigationRegistry(model);
  const sharedScenario = registry.entries.find((entry) => entry.target.kind === "scenario" && entry.patternIds.length > 1);
  const ambiguous = applyNavigationBatch(registry, initialExplorerNavigation, batch([{ type: "focus", target: sharedScenario.target }], registry));
  assert.equal(ambiguous.navigation.patternId, null);
  assert.deepEqual(ambiguous.navigation.scenarioIds, []);
});

test("a response drives navigation once and duplicate submissions are suppressed", async () => {
  const waiting = deferred(), requests = [];
  const store = makeStore((input) => { requests.push(input); return waiting.promise; });
  const pending = store.getState().ask("Why can Maya read this draft?");
  await store.getState().ask("duplicate");
  assert.equal(requests.length, 1);
  waiting.resolve({ ok: true, reply: reply() }); await pending;
  assert.equal(store.getState().navigation.focus.id, "test:launch-brief");
  assert.equal(store.getState().replyNavigation, "applied");
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().pending, false);
});

test("manual navigation during an AI request wins; explicitly showing the answer applies its commands", async () => {
  const waiting = deferred(), store = makeStore(() => waiting.promise);
  const pending = store.getState().ask("Inspect Launch brief");
  store.getState().navigate(batch([{ type: "focus", target: target("selector", "test:handbook") }]));
  waiting.resolve({ ok: true, reply: reply() }); await pending;
  assert.equal(store.getState().navigation.focus.id, "test:handbook");
  assert.equal(store.getState().replyNavigation, "available");
  store.getState().applyReply();
  assert.equal(store.getState().navigation.focus.id, "test:launch-brief");
});

test("model replacement, clearing or AI changes cancel old answers; tabs stay isolated", async () => {
  for (const invalidate of [(store) => store.getState().replaceRegistry({ ...fixtureRegistry, revision: "new" }), (store) => store.getState().clearConversation()]) {
    const waiting = deferred(), store = makeStore(() => waiting.promise), other = makeStore();
    const pending = store.getState().ask("question"); invalidate(store);
    waiting.resolve({ ok: true, reply: reply() }); await pending;
    assert.equal(store.getState().reply, null);
    assert.equal(store.getState().navigation.focus, null);
    assert.equal(store.getState().pending, false);
    assert.equal(other.getState().question, null);
  }
});

test("transport failure and invalid outputs preserve current navigation and redact raw errors", async () => {
  for (const transport of [async () => { throw new Error("secret API error"); }, async () => ({ ok: true, reply: { ...reply(), commands: [{ type: "delete" }] } })]) {
    const store = makeStore(transport);
    await store.getState().ask("question");
    assert.equal(store.getState().navigation.focus, null);
    assert.equal(store.getState().pending, false);
    assert.ok(store.getState().error);
    assert.equal(JSON.stringify(store.getState()).includes("secret"), false);
  }
});
