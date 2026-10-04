import "server-only";

import { createHash } from "node:crypto";
import Ajv from "ajv";
import { jsonSchema, type JSONSchema7 } from "ai";
import { AnalysisValidationError, validateAuthorizationModel } from "./analysis-validation.ts";
import { all, createSymbolicEvaluator } from "./authorization-evaluation.ts";
import type { AuthorizationModel, Condition, Scalar } from "./authorization-model-types.ts";
import type { PreparedAnalysis } from "./analysis-types.ts";

const text = { type: "string", maxLength: 240 };
const id = { type: "string", maxLength: 80 };
const scalar = { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }] };
const nullableId = { anyOf: [id, { type: "null" }] };
const list = (items: unknown, maxItems = 24) => ({ type: "array", items, maxItems });
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const enumeration = (...values: string[]) => ({ type: "string", enum: values });
const condition = (kind: unknown, properties: Record<string, unknown>) => object({ id, kind, ...properties });

// The model authors semantics once. Canonical graph bookkeeping, evaluations,
// provenance envelopes and UI controls are compiled locally, not generated.
export const compactAnalysisSchema = object({
  entities: list(object({ id, label: text, capabilities: list(enumeration("actor", "resource", "context", "relationship_record"), 4), sources: list(id, 8) }), 16),
  relationships: list(object({ id, label: text, participants: list(object({ key: id, entity: id }), 6), record: nullableId, sources: list(id, 8) }), 16),
  selectors: list(object({ id, label: text, entity: id, context: list(object({ name: id, entity: id }), 4), condition: nullableId }), 24),
  variables: list(object({ id, label: text, binding: id, type: enumeration("boolean", "string", "number"), choices: list(scalar, 8), source: enumeration("attribute", "relationship_fact", "request_context", "external_fact") }), 16),
  conditions: list({ anyOf: [
    condition(enumeration("constant"), { value: { type: "boolean" } }),
    condition(enumeration("all", "any"), { conditions: list(id, 12) }),
    condition(enumeration("not"), { condition: id }),
    condition(enumeration("compare"), { variable: id, operator: enumeration("eq", "ne", "in", "not_in"), values: list(scalar, 8) }),
    condition(enumeration("opaque"), { summary: text }),
  ] }, 40),
  access: list(object({
    id, label: text, actor: id, target: id, action: id,
    crud: { anyOf: [enumeration("create", "read", "update", "delete"), { type: "null" }] },
    level: enumeration("instance", "collection"), condition: id, basis: enumeration("implemented", "intended"),
    coverage: enumeration("complete", "partial", "unknown"), sources: list(id, 8),
    paths: list(object({ id, label: text, condition: id, relationships: list(id, 6) }), 4),
    scenarios: list(object({ label: text, facts: list(object({ variable: id, value: scalar }), 8) }), 2),
  }), 24),
  limits: list(text, 6),
});

type CompactCondition = { id: string } & (
  | { kind: "constant"; value: boolean }
  | { kind: "all" | "any"; conditions: string[] }
  | { kind: "not"; condition: string }
  | { kind: "compare"; variable: string; operator: "eq" | "ne" | "in" | "not_in"; values: Scalar[] }
  | { kind: "opaque"; summary: string }
);
export type CompactAnalysis = {
  entities: { id: string; label: string; capabilities: AuthorizationModel["entityTypes"][number]["capabilities"]; sources: string[] }[];
  relationships: { id: string; label: string; participants: { key: string; entity: string }[]; record: string | null; sources: string[] }[];
  selectors: { id: string; label: string; entity: string; context: { name: string; entity: string }[]; condition: string | null }[];
  variables: { id: string; label: string; binding: string; type: "boolean" | "string" | "number"; choices: Scalar[]; source: AuthorizationModel["variables"][number]["source"] }[];
  conditions: CompactCondition[];
  access: { id: string; label: string; actor: string; target: string; action: string; crud: "create" | "read" | "update" | "delete" | null; level: "instance" | "collection"; condition: string; basis: "implemented" | "intended"; coverage: "complete" | "partial" | "unknown"; sources: string[]; paths: { id: string; label: string; condition: string; relationships: string[] }[]; scenarios: { label: string; facts: { variable: string; value: Scalar }[] }[] }[];
  limits: string[];
};
const validateCompact = new Ajv({ allErrors: true, strict: false }).compile<CompactAnalysis>(compactAnalysisSchema);
// Wire IDs are opaque keys. Model-provided prefixes must not leak into the
// canonical ID grammar or collide after punctuation is normalized.
const ref = (kind: string, value: string) => derived(kind, value);
const derived = (kind: string, value: string) => `${kind}:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;

export function compileAnalysis(value: unknown, prepared: PreparedAnalysis): AuthorizationModel {
  if (!validateCompact(value)) throw new AnalysisValidationError((validateCompact.errors ?? []).map((error) => `Compact field ${error.instancePath || "/"}: ${error.keyword}.`));
  if (JSON.stringify(value).length > 16_000) throw new AnalysisValidationError(["The compact authorization response exceeded 16000 characters."]);
  const wire = value;
  const model: AuthorizationModel = {
    schemaVersion: "authzcope.authorization-model.v1-draft", modelId: prepared.modelId,
    snapshotRevision: prepared.snapshotRevision, contextRevision: prepared.contextRevision, materialization: "symbolic",
    coverage: { analyzedObjectIds: prepared.includedIds, externalDependencyIds: prepared.externalIds, exclusions: prepared.exclusions,
      missingInputs: ["Live actors and resources", ...(prepared.contextSourceIds.length ? [] : ["Independent application intent"] )],
      limits: [...wire.limits, "Symbolic analysis only; no SQL access checks were executed."] },
    claims: [], entityTypes: [], relationshipTypes: [], actions: [], selectors: [], variables: [], conditions: [], rules: [],
    accessPaths: [], scenarios: [], scenarioSpaces: [], accessPatterns: [], facets: [], scenarioControls: [], findings: [],
    presentation: { groups: [], perspectives: [], defaultPerspectiveId: "", overviewGroupIds: [], overviewPatternIds: [], defaultActionIds: [], defaultScenarioId: null },
  };
  const sources = (aliases: string[]) => aliases.map((alias) => {
    const sourceId = prepared.sourceAliases[alias];
    if (!sourceId) throw new AnalysisValidationError(["Response cites an unsupplied evidence source."]);
    return sourceId;
  });
  const claim = (id: string, statement: string, basis: "implemented" | "intended", aliases: string[]) => {
    const sourceIds = sources(aliases);
    const claimId = derived("claim", id);
    model.claims.push({ id: claimId, statement, basis, support: "inferred", evidenceRefs: sourceIds.map((sourceId) => {
      const source = prepared.evidenceRegistry[sourceId] as { definition?: string; text?: string };
      return { sourceId, pointer: source.text !== undefined ? "/text" : source.definition ? "/definition" : "/details" };
    }) });
    return [claimId];
  };
  const symbolicClaimId = "claim:symbolic-interpretation";
  model.claims.push({ id: symbolicClaimId, statement: "Conditions and scenario facts are symbolic interpretations; they do not establish live access.", basis: "assumption", support: "inferred", evidenceRefs: [] });
  const sourceBasis = (aliases: string[]) => sources(aliases).some((id) => !prepared.contextSourceIds.includes(id)) ? "implemented" as const : "intended" as const;
  model.entityTypes = wire.entities.map((entity) => ({ id: ref("entity", entity.id), label: entity.label, pluralLabel: entity.label,
    capabilities: entity.capabilities, sourceIds: sources(entity.sources), attributes: [], claimIds: claim(`entity/${entity.id}`, entity.label, sourceBasis(entity.sources), entity.sources) }));
  model.relationshipTypes = wire.relationships.map((relationship) => ({ id: ref("relationship", relationship.id), label: relationship.label,
    participants: relationship.participants.map((participant) => ({ key: participant.key, label: participant.key, entityTypeId: ref("entity", participant.entity) })),
    recordEntityTypeId: relationship.record ? ref("entity", relationship.record) : null,
    sourceIds: sources(relationship.sources), visualPurpose: "access", claimIds: claim(`relationship/${relationship.id}`, relationship.label, sourceBasis(relationship.sources), relationship.sources) }));
  model.selectors = wire.selectors.map((selector) => ({ id: ref("selector", selector.id), label: selector.label, entityTypeId: ref("entity", selector.entity),
    kind: "symbolic", contextBindings: selector.context.map((binding) => ({ name: binding.name, entityTypeId: ref("entity", binding.entity) })),
    whereConditionId: selector.condition ? ref("condition", selector.condition) : null, instanceEvidenceRef: null,
    claimIds: model.entityTypes.find((entity) => entity.id === ref("entity", selector.entity))?.claimIds ?? [symbolicClaimId] }));
  model.variables = wire.variables.map((variable) => ({ id: ref("variable", variable.id), label: variable.label, bindingRef: variable.binding,
    valueType: variable.type, nullable: variable.choices.includes(null), choices: variable.choices.map((value) => ({ value, label: String(value) })), source: variable.source, claimIds: [symbolicClaimId] }));
  model.conditions = wire.conditions.map((condition): Condition => {
    const base = { id: ref("condition", condition.id), claimIds: [symbolicClaimId] };
    switch (condition.kind) {
      case "constant": return { ...base, kind: "constant", value: condition.value };
      case "all": case "any": return { ...base, kind: condition.kind, conditionIds: condition.conditions.map((id) => ref("condition", id)) };
      case "not": return { ...base, kind: "not", conditionId: ref("condition", condition.condition) };
      case "compare": return { ...base, kind: "compare", variableId: ref("variable", condition.variable), operator: condition.operator, values: condition.values };
      case "opaque": return { ...base, kind: "opaque", summary: condition.summary, bindingRefs: [] };
    }
  });
  for (const access of wire.access) {
    const actor = model.selectors.find((selector) => selector.id === ref("selector", access.actor));
    const target = model.selectors.find((selector) => selector.id === ref("selector", access.target));
    if (!actor || !target) throw new AnalysisValidationError(["Access selectors must resolve."]);
    const ruleId = ref("rule", access.id), conditionId = ref("condition", access.condition);
    const actionId = derived("action", `${target.entityTypeId}/${access.action}/${access.level}`);
    if (!model.actions.some((action) => action.id === actionId)) model.actions.push({ id: actionId, label: access.action, crud: access.crud,
      targetEntityTypeId: target.entityTypeId, targetLevel: access.level, createsEntityTypeId: access.level === "collection" && access.crud === "create" ? target.entityTypeId : null, claimIds: [] });
    const claimIds = claim(ruleId, access.label, access.basis, access.sources);
    model.rules.push({ id: ruleId, label: access.label, basis: access.basis, actorSelectorId: actor.id, targetSelectorId: target.id, actionId,
      eligibilityConditionId: conditionId, coverage: access.coverage, claimIds,
      implementationBindings: sources(access.sources).filter((id) => !prepared.contextSourceIds.includes(id)).map((sourceId) => {
        const source = prepared.evidenceRegistry[sourceId] as { kind: string; details?: { relationKind?: string } };
        const mechanism = source.kind === "policy" ? "policy" : source.kind === "routine" ? "helper" : source.kind === "trigger" ? "trigger"
          : source.details?.relationKind === "v" ? "view" : ["relation", "schema", "default_privileges"].includes(source.kind) ? "grant" : "external";
        return { sourceId, mechanism, phase: "not_applicable" };
      }) });
    const pathIds: string[] = [];
    if (access.basis === "implemented") for (const path of access.paths) {
      const pathId = derived("path", `${ruleId}/${path.id}`);
      pathIds.push(pathId);
      model.accessPaths.push({ id: pathId, label: path.label, ruleId, eligibilityConditionId: ref("condition", path.condition),
        relationshipTypeIds: path.relationships.map((id) => ref("relationship", id)), selectorIds: [actor.id, target.id], claimIds });
    }
    const spaceId = derived("space", ruleId), patternId = derived("pattern", ruleId);
    const varying = new Set<string>();
    const scenarioIds = access.scenarios.map((scenario, index) => {
      const scenarioId = derived("scenario", `${ruleId}/${index}`);
      model.scenarios.push({ id: scenarioId, label: scenario.label, kind: "hypothetical", actorSelectorId: actor.id, targetSelectorId: target.id,
        facts: scenario.facts.map((fact) => { const variableId = ref("variable", fact.variable); varying.add(variableId); return { variableId, value: fact.value, basis: "assumed", evidenceRefs: [] }; }), claimIds });
      return scenarioId;
    });
    const existing = model.accessPatterns.find((pattern) => pattern.actorSelectorId === actor.id && pattern.targetSelectorId === target.id && pattern.actionId === actionId);
    if (existing) {
      existing.implementedRuleIds.push(...(access.basis === "implemented" ? [ruleId] : []));
      existing.intendedRuleIds.push(...(access.basis === "intended" ? [ruleId] : []));
      existing.pathIds.push(...pathIds);
      existing.claimIds.push(...claimIds);
      if (access.coverage !== "complete") existing.completeness = access.coverage;
      const space = model.scenarioSpaces.find((space) => space.id === existing.scenarioSpaceId)!;
      space.scenarioIds.push(...scenarioIds);
      space.varyingVariableIds = [...new Set([...space.varyingVariableIds, ...varying])];
      continue;
    }
    model.scenarioSpaces.push({ id: spaceId, label: access.label, actorSelectorId: actor.id, targetSelectorId: target.id,
      fixedFacts: [], varyingVariableIds: [...varying], scenarioIds, coverage: "representative", boundary: "Supplied hypothetical facts; unresolved checks stay unknown.", claimIds });
    model.accessPatterns.push({ id: patternId, label: access.label, actorSelectorId: actor.id, targetSelectorId: target.id, actionId,
      implementedRuleIds: access.basis === "implemented" ? [ruleId] : [], intendedRuleIds: access.basis === "intended" ? [ruleId] : [],
      pathIds, scenarioSpaceId: spaceId, classification: "unknown", completeness: access.coverage,
      currentEvaluationId: null, evaluations: [], sidebarSummary: access.label, claimIds: [...claimIds] });
  }
  for (const selector of model.selectors) {
    const entity = model.entityTypes.find((entity) => entity.id === selector.entityTypeId);
    if (entity?.capabilities.includes("actor") || entity?.capabilities.includes("resource")) model.presentation.perspectives.push({
      id: derived("perspective", selector.id), label: selector.label, kind: entity.capabilities.includes("actor") ? "actor" : "resource", anchorSelectorId: selector.id,
    });
  }
  for (const action of model.actions) action.claimIds = [...new Set(model.rules.filter((rule) => rule.actionId === action.id).flatMap((rule) => rule.claimIds))];
  model.scenarioControls = model.variables.flatMap((variable) => {
    const scenarioSpaceIds = model.scenarioSpaces.filter((space) => space.varyingVariableIds.includes(variable.id)).map((space) => space.id);
    return scenarioSpaceIds.length && variable.choices.length ? [{ id: derived("control", variable.id), label: variable.label,
      effect: "simulate" as const, variableId: variable.id, scenarioSpaceIds, options: variable.choices, claimIds: variable.claimIds }] : [];
  });
  model.presentation.defaultPerspectiveId = model.presentation.perspectives.find((perspective) => perspective.kind === "actor")?.id ?? model.presentation.perspectives[0]?.id ?? "";
  model.presentation.overviewPatternIds = model.accessPatterns.map((pattern) => pattern.id);
  model.presentation.defaultActionIds = model.actions.map((action) => action.id);
  // Reject dangling references and unsupported intent before deriving anything.
  validateAuthorizationModel(model, prepared);
  for (const pattern of model.accessPatterns) {
    pattern.evaluations = model.scenarios.filter((scenario) => model.scenarioSpaces.find((space) => space.id === pattern.scenarioSpaceId)!.scenarioIds.includes(scenario.id)).map((scenario) => {
      const evaluator = createSymbolicEvaluator(model, new Map(scenario.facts.map((fact) => [fact.variableId, fact.value])));
      const decision = (ruleIds: string[]): AuthorizationModel["accessPatterns"][number]["evaluations"][number]["implemented"] => {
        const result = evaluator.rules(ruleIds);
        return { outcome: result === null ? "unknown" : result ? "allowed" : "denied", method: "symbolic_derivation",
          pathStates: pattern.pathIds.map((pathId) => { const path = model.accessPaths.find((path) => path.id === pathId)!;
            const result = all([evaluator.rule(path.ruleId), evaluator.condition(path.eligibilityConditionId)]);
            return { pathId, state: result === null ? "unknown" : result ? "satisfied" : "unsatisfied" }; }),
          unresolvedConditionIds: model.conditions.filter((condition) => evaluator.condition(condition.id) === null).map((condition) => condition.id), claimIds: pattern.claimIds };
      };
      return { id: derived("evaluation", `${pattern.id}/${scenario.id}`), scenarioId: scenario.id,
        implemented: decision(pattern.implementedRuleIds), intended: pattern.intendedRuleIds.length ? decision(pattern.intendedRuleIds) : null };
    });
    const outcomes = pattern.evaluations.map((evaluation) => evaluation.implemented.outcome);
    if (outcomes.includes("allowed") && outcomes.includes("denied")) pattern.classification = "conditional";
    if (pattern.completeness === "complete" && pattern.implementedRuleIds.length) {
      const proof = createSymbolicEvaluator(model, new Map()).rules(pattern.implementedRuleIds);
      if (proof !== null) pattern.classification = proof ? "always" : "never";
    }
  }
  return validateAuthorizationModel(model, prepared);
}

export function compactAnalysisOutputSchema(prepared: PreparedAnalysis) {
  return jsonSchema<AuthorizationModel>(compactAnalysisSchema as JSONSchema7, {
    validate(value) {
      try { return { success: true, value: compileAnalysis(value, prepared) }; }
      catch (error) { return { success: false, error: error instanceof Error ? error : new AnalysisValidationError(["Invalid compact response."]) }; }
    },
  });
}
