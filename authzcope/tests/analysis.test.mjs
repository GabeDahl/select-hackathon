import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { prepareAnalysis, validateAnalysisInput } from "../lib/analysis-input.ts";
import { authorizationOutputSchema, validateAuthorizationModel } from "../lib/analysis-validation.ts";
import { createSymbolicEvaluator } from "../lib/authorization-evaluation.ts";
import { runAuthorizationAnalysis } from "../lib/analysis-service.ts";
import contract from "../docs/authorization-model.schema.json" with { type: "json" };
import { catalogOriginHint, hasSupabasePlatform } from "../lib/catalog-origin.ts";
import { analysisFixture, compactAnalysisFixture, catalogObject, snapshot, imported, providerStreamResponse } from "./analysis-fixtures.mjs";
import { compileAnalysis, compactAnalysisSchema } from "../lib/analysis-authoring.ts";

const names = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "AI_API_KEY", "AI_PROVIDER"];
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
beforeEach(() => names.forEach((name) => delete process.env[name]));
afterEach(() => { mock.restoreAll(); for (const [name, value] of Object.entries(original)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });

test("prepares arbitrary domain evidence, attached policies and transitive external dependencies without credentials", () => {
  const db = snapshot([
    catalogObject("relation:laboratory.specimens"),
    catalogObject("policy:laboratory.specimens POLICY inspect", { kind: "policy", details: { relation: "laboratory.specimens" }, defaultIncluded: false, definition: "USING (private.can_inspect(id))" }),
    catalogObject("routine:private.can_inspect(specimen_id uuid)", { kind: "routine", schema: "private", name: "can_inspect", defaultIncluded: false, definition: "SELECT auth.uid() IS NOT NULL" }),
    catalogObject("routine:auth.uid()", { kind: "routine", schema: "auth", name: "uid", defaultIncluded: false }),
    catalogObject("relation:platform.unrelated", { schema: "platform", name: "unrelated", defaultIncluded: false }),
  ]);
  db.dependencies = [[db.objects[1].id, db.objects[2].id], [db.objects[2].id, db.objects[3].id]].map(([fromId, toId]) => ({ fromId, toId }));
  const prepared = prepareAnalysis(db, { [db.objects[1].id]: false }, "Staff can inspect assigned specimens.");
  assert.deepEqual(prepared.includedIds, [db.objects[0].id]);
  assert.equal(prepared.externalIds.length, 3);
  assert.deepEqual(prepared.exclusions.map((item) => item.sourceId), [db.objects[4].id]);
  const payload = JSON.parse(prepared.payload);
  const alias = (id) => Object.keys(prepared.sourceAliases).find((key) => prepared.sourceAliases[key] === id);
  assert.equal(payload.evidence[alias(db.objects[1].id)].sql, db.objects[1].definition);
  assert.equal(payload.evidence[alias("context:application")].text, "Staff can inspect assigned specimens.");
  assert.equal(prepared.payload.includes("connectionString"), false);
  assert.equal(prepared.payload.includes("aiApiKey"), false);
  assert.notEqual(prepared.contextRevision, prepareAnalysis(db, {}, "different intent").contextRevision);
  assert.throws(() => prepareAnalysis(db, { "relation:unknown": true }, ""), /scope no longer/);
  assert.throws(() => prepareAnalysis(snapshot([]), {}, ""), /at least one/);
  assert.throws(() => prepareAnalysis(snapshot([catalogObject("relation:huge", { definition: "x".repeat(1_000_000) })]), {}, ""), /too large/);
});

test("Supabase/platform origin hints do not become domain resources or discard custom platform policies", () => {
  const objects = [catalogObject("relation:public.specimens", { schema: "public" }),
    catalogObject("schema:auth", { kind: "schema", schema: "auth", name: "auth", defaultIncluded: false }),
    catalogObject("schema:storage", { kind: "schema", schema: "storage", name: "storage", defaultIncluded: false }),
    catalogObject("role:service_role", { kind: "role", schema: null, name: "service_role", defaultIncluded: false }),
    catalogObject("routine:auth.uid()", { kind: "routine", schema: "auth", defaultIncluded: true }),
    catalogObject("policy:storage.objects POLICY custom_visibility", { kind: "policy", schema: "storage", details: { relation: "storage.objects" }, definition: "USING (private.custom_rule(id))" }),
    catalogObject("trigger:public.specimens TRIGGER internal_fk", { kind: "trigger", schema: "public", details: { internal: true } }),
  ];
  const db = snapshot(objects);
  db.dependencies = [{ fromId: objects[0].id, toId: objects[4].id }];
  assert.equal(hasSupabasePlatform(db), true);
  const prepared = prepareAnalysis(db, {}, "");
  assert.equal(prepared.evidenceRegistry[objects[0].id].originHint, "application_or_unknown");
  assert.equal(prepared.evidenceRegistry[objects[4].id].originHint, "supabase_candidate");
  assert.equal(prepared.evidenceRegistry[objects[5].id].definition, objects[5].definition);
  assert.equal(prepared.evidenceRegistry[objects[6].id], undefined);
  assert.ok(prepared.exclusions.some((item) => item.sourceId === objects[6].id));
  assert.equal(prepareAnalysis(db, { [objects[6].id]: true }, "").evidenceRegistry[objects[6].id].originHint, "postgres_internal");
  assert.equal(catalogOriginHint(objects[4], false), "application_or_unknown");
});

test("application foreign keys do not expand into the Supabase Auth catalog", () => {
  const table = catalogObject("relation:public.specimens", { schema: "public", name: "specimens" });
  const fk = catalogObject("constraint:public.specimens CONSTRAINT actor_fk", { kind: "constraint", schema: "public", details: { relation: "public.specimens", referencedRelation: "auth.users" } });
  const helper = catalogObject("routine:private.can_inspect(uuid)", { kind: "routine", schema: "private", name: "can_inspect", definition: "SELECT auth.uid() = actor_id FROM public.specimens" });
  const platform = [
    catalogObject("schema:auth", { kind: "schema", schema: "auth", name: "auth", defaultIncluded: false }),
    catalogObject("schema:storage", { kind: "schema", schema: "storage", name: "storage", defaultIncluded: false }),
    catalogObject("role:service_role", { kind: "role", schema: null, name: "service_role", defaultIncluded: false }),
    // Simulate an older snapshot with dependencies promoted to defaultIncluded.
    catalogObject("relation:auth.users", { schema: "auth", name: "users" }),
    catalogObject("routine:auth.uid()", { kind: "routine", schema: "auth", name: "uid", definition: "SELECT current_setting('request.jwt.claim.sub', true)::uuid" }),
    catalogObject("relation:auth.sessions", { schema: "auth", name: "sessions" }),
  ];
  const noise = Array.from({ length: 300 }, (_, i) => catalogObject(`constraint:auth.users CONSTRAINT noise_${i}`, { kind: "constraint", schema: "auth", details: { relation: "auth.users", referencedRelation: "auth.sessions" }, definition: "platform-machinery".repeat(100) }));
  const db = snapshot([table, fk, helper, ...platform, ...noise]);
  db.dependencies = noise.map((object) => ({ fromId: object.id, toId: platform[5].id, from: { subId: 0 } }));
  const prepared = prepareAnalysis(db, {}, "");
  assert.deepEqual(prepared.includedIds, [fk.id, table.id, helper.id].sort());
  assert.ok(prepared.externalIds.includes("relation:auth.users"));
  assert.ok(prepared.externalIds.includes("routine:auth.uid()"));
  assert.equal(prepared.evidenceRegistry["relation:auth.sessions"], undefined);
  const payload = JSON.parse(prepared.payload);
  assert.equal(payload.dependencies, undefined);
  assert.equal(payload.scope, undefined);
  assert.equal(Object.values(payload.omitted).reduce((sum, count) => sum + count, 0), prepared.exclusions.length);
  assert.ok(prepared.payload.length < 10_000);
  assert.equal(prepared.payload.includes("noise_"), false);
  assert.equal(db.objects.length, 309);
  const explicit = prepareAnalysis(snapshot([table, fk, helper, ...platform, noise[0]]), { "relation:auth.users": true }, "");
  assert.ok(explicit.externalIds.includes(noise[0].id), "explicit platform resources retain attached evidence");
});

test("scope and original evidence survive model output without copying infrastructure exclusions", async () => {
  const fixture = compactAnalysisFixture([catalogObject("relation:platform.omitted", { defaultIncluded: false })]);
  const prepared = fixture.prepared;
  mock.method(globalThis, "fetch", async () => providerStreamResponse("openai", JSON.stringify(fixture.wire)));
  const result = await runAuthorizationAnalysis(fixture.input, async () => imported(fixture.snapshot));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.model.coverage.exclusions, []);
  assert.equal(validateAuthorizationModel({ ...result.model, coverage: { ...result.model.coverage, exclusions: prepared.exclusions } }, prepared).modelId, result.model.modelId);
});

test("validates request input before database/provider work", () => {
  const { input } = analysisFixture();
  assert.deepEqual(validateAnalysisInput(input), input);
  for (const changes of [{ snapshotRevision: "old" }, { database: [] }, { ai: [] }, { scopeOverrides: { a: "yes" } }, { supportingContext: "x".repeat(40_001) }]) {
    assert.throws(() => validateAnalysisInput({ ...input, ...changes }));
  }
});

test("compact authoring derives scoped outcomes and paths without duplicating them on the wire", () => {
  const { wire, prepared, model } = compactAnalysisFixture();
  assert.ok(JSON.stringify(wire).length < 2500);
  assert.ok(JSON.stringify(compactAnalysisSchema).length < 8000);
  assert.equal(model.accessPatterns.length, 1, "intended and implemented rules share one scope");
  assert.equal(model.accessPatterns[0].classification, "conditional");
  assert.deepEqual(model.accessPatterns[0].evaluations.map((evaluation) => evaluation.implemented.outcome), ["allowed", "denied"]);
  assert.deepEqual(model.accessPatterns[0].evaluations.map((evaluation) => evaluation.intended.outcome), ["allowed", "denied"]);
  assert.ok(model.accessPatterns[0].evaluations.every((evaluation) => evaluation.implemented.method === "symbolic_derivation"));
  const opaque = structuredClone(wire);
  opaque.conditions = [{ id: "assigned", kind: "opaque", summary: "Assignment requires an unavailable external check." }];
  const uncertain = compileAnalysis(opaque, prepared);
  assert.equal(uncertain.accessPatterns[0].classification, "unknown");
  assert.ok(uncertain.accessPatterns[0].evaluations.every((evaluation) => evaluation.implemented.outcome === "unknown"));
  for (const mutate of [
    (w) => { w.access[0].sources = ["fake"]; },
    (w) => { w.access[0].target = "fake"; },
    (w) => { w.conditions = [{ id: "assigned", kind: "not", condition: "assigned" }]; },
    (w) => { w.access[1].sources = w.access[0].sources; },
    (w) => { w.access[0].scenarios[0].facts[0].value = "true"; },
  ]) { const invalid = structuredClone(wire); mutate(invalid); assert.throws(() => compileAnalysis(invalid, prepared)); }
});

test("compact compiler gives reused path labels distinct IDs and supports opaque wire IDs", () => {
  const { wire, prepared } = compactAnalysisFixture();
  const secondRule = structuredClone(wire.access[0]);
  secondRule.id = "implemented:inspect/second";
  wire.access.push(secondRule);
  wire.entities[0].id = "actor:researcher";
  wire.selectors[0].entity = "actor:researcher";
  wire.relationships[0].participants[0].entity = "actor:researcher";
  const model = compileAnalysis(wire, prepared);
  assert.equal(model.accessPaths.length, 2);
  assert.equal(new Set(model.accessPaths.map((path) => path.id)).size, 2);
  assert.equal(new Set(model.accessPatterns[0].pathIds).size, 2);
  assert.deepEqual(compileAnalysis(wire, prepared), model, "Canonical IDs remain stable for identical evidence and output");
});

test("SDK-wrapped validation errors preserve safe issues, without returning provider content", async () => {
  const fixture = compactAnalysisFixture();
  fixture.wire.access[0].target = "api-secret-unknown-selector";
  mock.method(globalThis, "fetch", async () => providerStreamResponse("openai", JSON.stringify(fixture.wire)));
  const result = await runAuthorizationAnalysis(fixture.input, async () => imported(fixture.snapshot));
  assert.equal(result.code, "invalid_output");
  assert.deepEqual(result.issues, ["Access selectors must resolve."]);
  assert.equal(JSON.stringify(result).includes("api-secret"), false);
});

test("output token exhaustion is reported separately from a semantic validation failure", async () => {
  const fixture = compactAnalysisFixture();
  mock.method(globalThis, "fetch", async () => providerStreamResponse("openai", '{"entities": [', { incomplete: true }));
  const result = await runAuthorizationAnalysis(fixture.input, async () => imported(fixture.snapshot));
  assert.equal(result.code, "invalid_output");
  assert.match(result.message, /exhausted its output token budget/);
});

test("accepts the full symbolic contract and independently checks additive access, lifecycle denial, and unknown facts", () => {
  const { model, prepared } = analysisFixture();
  assert.equal(validateAuthorizationModel(model, prepared), model);
  const read = model.accessPatterns.find((item) => item.id === "pattern:read");
  const result = read.evaluations.find((item) => item.scenarioId === "scenario:published-share-removed");
  assert.equal(result.implemented.outcome, "allowed");
  assert.equal(result.implemented.pathStates.filter((state) => state.state === "satisfied").length, 1);
  assert.equal(createSymbolicEvaluator(model, new Map()).rules(read.implementedRuleIds), null);
  assert.equal(model.accessPatterns.find((item) => item.id === "pattern:edit").evaluations.find((item) => item.scenarioId === "scenario:archived-editor-share").implemented.outcome, "denied");
  const schema = authorizationOutputSchema(prepared).jsonSchema;
  assert.deepEqual(schema.properties.schemaVersion, { enum: [model.schemaVersion], type: "string" });
  assert.equal(schema.definitions.condition.anyOf[0].properties.kind.type, "string");
});

test("provider schema preserves named definitions and resolves every local reference", () => {
  const { prepared } = analysisFixture();
  const schema = authorizationOutputSchema(prepared).jsonSchema;
  assert.deepEqual(Object.keys(schema.definitions), Object.keys(contract.definitions));
  assert.equal(schema.definitions.pattern.type, "object");
  assert.equal(schema.definitions.id.pattern, undefined);
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") {
      assert.ok(value.$ref.startsWith("#/"));
      let target = schema;
      for (const key of value.$ref.slice(2).split("/")) target = target?.[key.replaceAll("~1", "/").replaceAll("~0", "~")];
      assert.ok(target, `Unresolved provider schema reference: ${value.$ref}`);
    }
    Object.values(value).forEach(visit);
  }
  visit(schema);
});

const invalidMutations = [
  ["extra fields", (m) => { m.extra = true; }],
  ["wrong revision", (m) => { m.snapshotRevision = "different"; }],
  ["duplicate IDs", (m) => { m.actions[1].id = m.actions[0].id; }],
  ["dangling references", (m) => { m.accessPaths[0].ruleId = "rule:missing"; }],
  ["unsupplied sources", (m) => { m.claims[0].evidenceRefs[0].sourceId = "repo:invented.md"; }],
  ["invalid evidence pointers", (m) => { m.claims[0].evidenceRefs[0].pointer = "/does-not-exist"; }],
  ["cyclic conditions", (m) => { m.conditions.find((c) => c.kind === "all").conditionIds = [m.conditions.find((c) => c.kind === "all").id]; }],
  ["fake live actors", (m) => { m.selectors[0].kind = "observed_instance"; }],
  ["fake observations", (m) => { m.scenarios[0].facts[0].basis = "observed"; }],
  ["invented runtime decisions", (m) => { m.accessPatterns[0].evaluations[0].implemented.method = "runtime_observation"; }],
  ["contradictory scenario facts", (m) => { m.scenarios[0].facts[0].value = false; }],
  ["incorrect symbolic outcomes", (m) => { m.accessPatterns[0].evaluations[0].implemented.outcome = "denied"; }],
  ["incorrect path states", (m) => { const state = m.accessPatterns[0].evaluations[0].implemented.pathStates[0]; state.state = state.state === "satisfied" ? "unsatisfied" : "satisfied"; }],
  ["unproved universal access", (m) => { m.accessPatterns[0].classification = "always"; m.accessPatterns[0].completeness = "complete"; }],
  ["conditional access without witnesses", (m) => { m.accessPatterns[0].evaluations = []; }],
  ["simulation of fixed assumptions", (m) => { m.scenarioControls[0].variableId = m.scenarioSpaces[0].fixedFacts[0].variableId; }],
  ["SQL mistaken for intent", (m) => { const claim = m.claims.find((c) => c.basis === "intended"); claim.evidenceRefs = [{ sourceId: m.coverage.analyzedObjectIds[0], pointer: "/definition" }]; }],
];
for (const [label, mutate] of invalidMutations) test(`rejects ${label}`, () => {
  const { model, prepared } = analysisFixture(); mutate(model);
  assert.throws(() => validateAuthorizationModel(model, prepared), /contract/);
});

for (const provider of ["openai", "anthropic", "google"]) test(`${provider}: introspection revision -> schema-backed prompt -> SDK structured output -> validated model`, async () => {
  const fixture = compactAnalysisFixture(); fixture.input.ai.aiProvider = provider;
  const requests = [];
  const phases = [];
  mock.method(globalThis, "fetch", async (_url, init) => {
    if (provider === "google") assert.match(String(_url), /:streamGenerateContent/);
    requests.push(JSON.parse(init.body));
    return providerStreamResponse(provider, JSON.stringify(fixture.wire));
  });
  const result = await runAuthorizationAnalysis(fixture.input, async (input) => { assert.equal(input.connectionString, fixture.input.database.connectionString); return imported(fixture.snapshot); }, { onProgress: (phase) => phases.push(phase) });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.model, fixture.model);
  assert.equal(requests.length, 1);
  assert.deepEqual(phases, ["checking_schema", "preparing_evidence", "generating_model", "receiving_model", "validating_model"]);
  if (provider !== "google") assert.equal(requests[0].stream, true);
  const body = JSON.stringify(requests[0]);
  assert.ok(body.includes("evidence") && body.includes("selectors"));
  assert.ok(body.includes("condition"));
  assert.ok(body.length < 15_000, `Entire mocked API request is ${body.length} characters`);
  assert.equal(body.includes("db-secret"), false);
  assert.equal(body.includes("api-secret"), false);
  assert.equal(JSON.stringify(result).includes("api-secret"), false);
});

test("cancellation during schema checking returns immediately and never starts a paid generation afterwards", async () => {
  const fixture = analysisFixture(), controller = new AbortController();
  let completeInspection;
  const inspection = new Promise((resolve) => { completeInspection = resolve; });
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("Unexpected provider call"); });
  const phases = [];
  const request = runAuthorizationAnalysis(fixture.input, () => inspection, {
    signal: controller.signal, onProgress: (phase) => phases.push(phase),
  });
  assert.deepEqual(phases, ["checking_schema"]);
  controller.abort();
  assert.equal((await request).code, "cancelled");
  completeInspection(imported(fixture.snapshot));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(phases, ["checking_schema"]);
});

test("stale schema, database failure and invalid AI configuration stop before a paid request", async () => {
  const fixture = analysisFixture();
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("Unexpected AI call"); });
  const stale = await runAuthorizationAnalysis(fixture.input, async () => imported({ ...fixture.snapshot, revision: "b".repeat(64) }));
  assert.equal(stale.code, "stale_snapshot");
  const database = await runAuthorizationAnalysis(fixture.input, async () => ({ ok: false, message: "Database unavailable" }));
  assert.equal(database.code, "database");
  const provider = await runAuthorizationAnalysis({ ...fixture.input, ai: { ...fixture.input.ai, aiModel: "" } }, async () => { throw new Error("Unexpected introspection"); });
  assert.equal(provider.code, "provider");
  assert.equal(fetch.mock.callCount(), 0);
});

test("invalid provider outputs and sensitive provider errors are redacted with no retry or fallback", async () => {
  const fixture = compactAnalysisFixture();
  const invalid = structuredClone(fixture.wire); invalid.access[0].sources[0] = "source:api-secret";
  const responses = [providerStreamResponse("openai", JSON.stringify(invalid)), providerStreamResponse("openai", "api-secret not JSON")];
  const fetch = mock.method(globalThis, "fetch", async () => responses.shift());
  for (let index = 0; index < 2; index++) {
    const result = await runAuthorizationAnalysis(fixture.input, async () => imported(fixture.snapshot));
    assert.equal(result.code, "invalid_output");
    assert.equal(JSON.stringify(result).includes("api-secret"), false);
  }
  assert.equal(fetch.mock.callCount(), 2);
  mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "api-secret", code: "invalid_api_key" } }, { status: 401 }));
  const result = await runAuthorizationAnalysis(fixture.input, async () => imported(fixture.snapshot));
  assert.equal(result.code, "provider");
  assert.match(result.message, /credentials/);
  assert.equal(JSON.stringify(result).includes("api-secret"), false);
});
