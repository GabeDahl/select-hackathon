import { readFileSync } from "node:fs";
import { prepareAnalysis } from "../lib/analysis-input.ts";
import { compileAnalysis } from "../lib/analysis-authoring.ts";

export const example = JSON.parse(readFileSync(new URL("../docs/authorization-model.example.json", import.meta.url), "utf8"));
export function catalogObject(id, changes = {}) {
  return { id, kind: "relation", schema: "laboratory", name: "specimens", identity: id.slice(id.indexOf(":") + 1),
    address: { classId: 1259, objectId: 42, subId: 0 }, comment: null, definition: "CREATE TABLE laboratory.specimens (id uuid);",
    extension: null, details: {}, defaultIncluded: true, scopeReason: "Application object.", ...changes };
}
export function snapshot(objects = [catalogObject("relation:laboratory.specimens")]) {
  return { formatVersion: 1, revision: "a".repeat(64), capturedAt: "2026-10-03T00:00:00Z", serverVersion: "17.6", serverVersionNumber: 170006,
    objects, dependencies: [], coverage: { collectionOmissions: [], notes: ["No application rows read."] } };
}
export const imported = (snapshot) => ({ ok: true, stage: "introspection", databaseSource: "input", snapshot });
export function analysisFixture() {
  // Rebind the repository-only design fixture to a supplied evidence registry.
  // These envelopes are test data, never evidence used in a real analysis.
  const sourceIds = new Set();
  function sources(item) {
    if (!item || typeof item !== "object") return;
    if (item.sourceId) sourceIds.add(item.sourceId);
    item.sourceIds?.forEach((id) => sourceIds.add(id));
    Object.values(item).forEach(sources);
  }
  sources(example);
  const sqlIds = [...sourceIds].filter((id) => id.endsWith(".sql"));
  const sourceMap = new Map(sqlIds.map((id, index) => [id, `relation:fixture.source_${index}`]));
  const database = snapshot(sqlIds.map((id) => catalogObject(sourceMap.get(id), { definition: `SQL evidence from ${id}` })));
  const context = "Independent intended rules from supplied application documentation.";
  const prepared = prepareAnalysis(database, {}, context);
  const model = structuredClone(example);
  function rebind(item) {
    if (!item || typeof item !== "object") return;
    if (item.sourceId) { item.sourceId = sourceMap.get(item.sourceId) ?? "context:application"; if (item.pointer) item.pointer = item.sourceId === "context:application" ? "/text" : "/definition"; }
    if (item.sourceIds) item.sourceIds = [...new Set(item.sourceIds.map((id) => sourceMap.get(id) ?? "context:application"))];
    Object.values(item).forEach(rebind);
  }
  rebind(model);
  Object.assign(model, { modelId: prepared.modelId, snapshotRevision: prepared.snapshotRevision, contextRevision: prepared.contextRevision });
  model.coverage.analyzedObjectIds = prepared.includedIds;
  model.coverage.externalDependencyIds = prepared.externalIds;
  model.coverage.exclusions = prepared.exclusions;
  const input = { database: { connectionString: "postgres://reader:db-secret@localhost/app" },
    ai: { aiProvider: "openai", aiModel: "chosen-model", aiApiKey: "api-secret" }, snapshotRevision: database.revision, scopeOverrides: {}, supportingContext: context };
  return { snapshot: database, prepared, model, input };
}

export function compactAnalysisFixture(snapshotChanges = []) {
  const fixture = analysisFixture();
  fixture.snapshot.objects.push(...snapshotChanges);
  const prepared = prepareAnalysis(fixture.snapshot, {}, fixture.input.supportingContext);
  const sql = Object.keys(prepared.sourceAliases).find((key) => prepared.sourceAliases[key] !== "context:application");
  const context = Object.keys(prepared.sourceAliases).find((key) => prepared.sourceAliases[key] === "context:application");
  const wire = {
    entities: [{ id: "researcher", label: "Researcher", capabilities: ["actor"], sources: [sql] }, { id: "specimen", label: "Specimen", capabilities: ["resource"], sources: [sql] }],
    relationships: [{ id: "assignment", label: "Assignment", participants: [{ key: "researcher", entity: "researcher" }, { key: "specimen", entity: "specimen" }], record: null, sources: [sql] }],
    selectors: [{ id: "researcher", label: "Researcher", entity: "researcher", context: [{ name: "specimen", entity: "specimen" }], condition: null }, { id: "specimen", label: "Specimen", entity: "specimen", context: [], condition: null }],
    variables: [{ id: "assigned", label: "Assigned", binding: "assignment.exists", type: "boolean", choices: [true, false], source: "relationship_fact" }],
    conditions: [{ id: "assigned", kind: "compare", variable: "assigned", operator: "eq", values: [true] }],
    access: [{ id: "inspect", label: "Assigned researchers can inspect specimens.", actor: "researcher", target: "specimen", action: "Inspect", crud: "read", level: "instance", condition: "assigned", basis: "implemented", coverage: "complete", sources: [sql],
      paths: [{ id: "assignment", label: "Assignment", condition: "assigned", relationships: ["assignment"] }],
      scenarios: [{ label: "Assigned", facts: [{ variable: "assigned", value: true }] }, { label: "Unassigned", facts: [{ variable: "assigned", value: false }] }] },
      { id: "intended-inspect", label: "Inspection is intended for assigned researchers.", actor: "researcher", target: "specimen", action: "Inspect", crud: "read", level: "instance", condition: "assigned", basis: "intended", coverage: "complete", sources: [context], paths: [], scenarios: [] }],
    limits: ["No live specimen rows supplied."],
  };
  return { ...fixture, prepared, wire, model: compileAnalysis(wire, prepared) };
}
export function providerResponse(provider, text, structured = false) {
  if (provider === "openai") return { id: "response-1", model: "chosen-model", created_at: 1,
    output: [{ type: "message", role: "assistant", id: "message-1", content: [{ type: "output_text", text, annotations: [] }] }],
    usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 } };
  if (provider === "anthropic") return { type: "message", id: "message-1", model: "chosen-model",
    content: structured ? [{ type: "tool_use", id: "tool-1", name: "json", input: JSON.parse(text) }] : [{ type: "text", text }],
    stop_reason: structured ? "tool_use" : "end_turn", usage: { input_tokens: 5, output_tokens: 2 } };
  return { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 } };
}

export function providerStreamResponse(provider, text, { incomplete = false } = {}) {
  let events;
  if (provider === "openai") events = [
    { type: "response.created", response: { id: "response-1", model: "chosen-model", created_at: 1 } },
    { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "message-1" } },
    { type: "response.output_text.delta", item_id: "message-1", output_index: 0, delta: text },
    { type: "response.output_item.done", output_index: 0, item: { type: "message", id: "message-1" } },
    { type: incomplete ? "response.incomplete" : "response.completed", response: {
      ...(incomplete ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
      usage: { input_tokens: 5, output_tokens: incomplete ? 4096 : 2, total_tokens: incomplete ? 4101 : 7 },
    } },
  ];
  else if (provider === "anthropic") events = [
    { type: "message_start", message: { id: "message-1", model: "chosen-model", role: "assistant", usage: { input_tokens: 5 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tool-1", name: "json", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 2 } },
  ];
  else events = [providerResponse("google", text)];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}
