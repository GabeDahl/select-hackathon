import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { runExplorerChat } from "../lib/explorer-chat-service.ts";
import { initialExplorerNavigation, createModelNavigationRegistry } from "../lib/explorer-navigation.ts";
import { analysisFixture, catalogObject, imported, providerResponse } from "./analysis-fixtures.mjs";
import { prepareAnalysis } from "../lib/analysis-input.ts";

const names = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "AI_API_KEY", "AI_PROVIDER"];
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
beforeEach(() => names.forEach((name) => delete process.env[name]));
afterEach(() => { mock.restoreAll(); for (const [name, value] of Object.entries(original)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
const fixtureInput = (provider = "openai") => {
  const fixture = analysisFixture();
  return { mode: "analysis", question: "Does removing the share remove access?", history: [], navigation: initialExplorerNavigation,
    analysis: { ...fixture.input, ai: { ...fixture.input.ai, aiProvider: provider } }, model: fixture.model };
};
const inspectFixture = async () => imported(analysisFixture().snapshot);
const fixtureReply = () => {
  const fixture = analysisFixture(), registry = createModelNavigationRegistry(fixture.model), pattern = registry.patterns[0];
  return { revision: registry.revision, answer: "Under the supplied symbolic assumptions, another path may remain.", claimIds: [],
    commands: [{ type: "compare", patternId: pattern.id, scenarioIds: pattern.scenarioIds.slice(0, 2) }] };
};

for (const provider of ["openai", "anthropic", "google"]) test(`${provider}: structured navigation reply uses the existing server provider transport`, async () => {
  const requests = [];
  mock.method(globalThis, "fetch", async (_url, init) => { requests.push(JSON.parse(init.body)); return Response.json(providerResponse(provider, JSON.stringify(fixtureReply()), true)); });
  const result = await runExplorerChat(fixtureInput(provider), inspectFixture);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.reply, fixtureReply());
  assert.equal(requests.length, 1);
  const body = JSON.stringify(requests[0]);
  assert.ok(body.includes("scenarioIds") && body.includes("evidence"));
  assert.equal(body.includes("api-secret"), false);
});

test("analysis chat validates graph/evidence and recollects schema before calling the provider", async () => {
  const fixture = analysisFixture(), registry = createModelNavigationRegistry(fixture.model), pattern = fixture.model.accessPatterns[0];
  const reply = { revision: registry.revision, answer: "Under the supplied symbolic assumptions, these paths explain read access.", claimIds: pattern.claimIds.slice(0, 1),
    commands: [{ type: "focus", target: { kind: "pattern", id: pattern.id } }, { type: "highlight", targets: pattern.pathIds.map((id) => ({ kind: "path", id })) }] };
  let request;
  mock.method(globalThis, "fetch", async (_url, init) => { request = JSON.parse(init.body); return Response.json(providerResponse("openai", JSON.stringify(reply), true)); });
  const result = await runExplorerChat({ mode: "analysis", analysis: fixture.input, model: fixture.model, history: [], question: "Why is this permitted?", navigation: initialExplorerNavigation }, async () => imported(fixture.snapshot));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.reply, reply);
  assert.ok(JSON.stringify(request).includes("evidence"));
  assert.equal(JSON.stringify(request).includes("db-secret"), false);
  assert.equal(JSON.stringify(request).includes("api-secret"), false);
});

test("follow-up chat does not resend the complete platform omission list", async () => {
  const fixture = analysisFixture();
  fixture.snapshot.objects.push(catalogObject("relation:platform.omitted_machinery", { defaultIncluded: false }));
  const prepared = prepareAnalysis(fixture.snapshot, {}, fixture.input.supportingContext);
  Object.assign(fixture.model, { modelId: prepared.modelId, contextRevision: prepared.contextRevision });
  fixture.model.coverage.exclusions = prepared.exclusions;
  const revision = createModelNavigationRegistry(fixture.model).revision;
  let body;
  mock.method(globalThis, "fetch", async (_url, init) => {
    body = init.body;
    return Response.json(providerResponse("openai", JSON.stringify({ revision, answer: "Symbolic access only.", claimIds: [], commands: [] })));
  });
  const result = await runExplorerChat({ mode: "analysis", analysis: fixture.input, model: fixture.model, question: "Explain access", history: [], navigation: initialExplorerNavigation }, async () => imported(fixture.snapshot));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(body.includes("omitted_machinery"), false);
  assert.equal(fixture.model.coverage.exclusions.length, 1);
});

test("stale schemas, invented instances, malformed questions, histories and targets stop before AI requests", async () => {
  const fixture = analysisFixture();
  const input = { mode: "analysis", analysis: fixture.input, model: fixture.model, question: "question", history: [], navigation: initialExplorerNavigation };
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("Unexpected AI call"); });
  const stale = await runExplorerChat(input, async () => imported({ ...fixture.snapshot, revision: "b".repeat(64) }));
  assert.equal(stale.code, "stale_snapshot");
  const fake = structuredClone(input); fake.model.selectors[0].kind = "observed_instance";
  assert.equal((await runExplorerChat(fake, async () => imported(fixture.snapshot))).code, "invalid_output");
  for (const changes of [{ question: " " }, { question: "x".repeat(4_001) }, { history: Array.from({ length: 7 }, () => ({ question: "q", answer: "a" })) },
    { navigation: { ...initialExplorerNavigation, focus: { kind: "selector", id: "unknown" } } }]) {
    assert.equal((await runExplorerChat({ ...fixtureInput(), ...changes }, inspectFixture)).code, "input");
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("invalid generated commands, unsupported citations and provider errors return safe messages", async () => {
  for (const changes of [{ commands: [{ type: "focus", target: { kind: "selector", id: "invented" } }] }, { claimIds: ["invented"] }, { commands: [{ type: "overview", sql: "secret" }] }]) {
    mock.method(globalThis, "fetch", async () => Response.json(providerResponse("openai", JSON.stringify({ ...fixtureReply(), ...changes }))));
    const result = await runExplorerChat(fixtureInput(), inspectFixture);
    assert.equal(result.code, "invalid_output");
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
  mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "api-secret", code: "invalid_api_key" } }, { status: 401 }));
  const result = await runExplorerChat(fixtureInput(), inspectFixture);
  assert.equal(result.code, "provider");
  assert.equal(JSON.stringify(result).includes("api-secret"), false);
});
