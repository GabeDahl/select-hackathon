import "server-only";

import Ajv from "ajv";
import { jsonSchema, type JSONSchema7 } from "ai";
import contract from "../docs/authorization-model.schema.json" with { type: "json" };
import type { AuthorizationModel, Scalar, ScenarioFact } from "./authorization-model-types.ts";
import type { PreparedAnalysis } from "./analysis-types.ts";
import { all, createSymbolicEvaluator } from "./authorization-evaluation.ts";

const validateShape = new Ajv({ allErrors: true, strict: false }).compile<AuthorizationModel>(contract);

export class AnalysisValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super("The model response did not satisfy the authorization contract.");
    this.name = "AnalysisValidationError";
    this.issues = issues.slice(0, 24);
  }
}

// Providers support different JSON Schema subsets. The complete canonical
// contract is always enforced locally, including constraints removed here.
function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(node)) {
    // These are maps of user-defined names, not schema nodes. A definition or
    // field named `pattern` must survive even when the schema keyword is removed.
    if (["properties", "definitions", "$defs"].includes(key) && item && typeof item === "object" && !Array.isArray(item)) {
      result[key] = Object.fromEntries(Object.entries(item).map(([name, schema]) => [name, providerSchema(schema)]));
      continue;
    }
    if (["$schema", "$id", "title", "uniqueItems", "minItems", "minLength", "pattern"].includes(key)) continue;
    if (key === "const") {
      result.enum = [item];
      result.type ??= item === null ? "null" : typeof item;
    }
    else if (key === "type" && Array.isArray(item)) result.anyOf = item.map((type) => ({ type }));
    else result[key] = providerSchema(item);
  }
  return result;
}

export function authorizationOutputSchema(prepared: PreparedAnalysis) {
  return jsonSchema<AuthorizationModel>(providerSchema(contract) as JSONSchema7, {
    validate(value) {
      try {
        // Omission coverage belongs to the server, not model inference. Only
        // the empty placeholder is expanded; fabricated exclusions still fail.
        if (value && typeof value === "object" && "coverage" in value && value.coverage &&
            typeof value.coverage === "object" && "exclusions" in value.coverage &&
            Array.isArray(value.coverage.exclusions) && value.coverage.exclusions.length === 0) {
          value = { ...value, coverage: { ...value.coverage, exclusions: prepared.exclusions } };
        }
        return { success: true, value: validateAuthorizationModel(value, prepared) };
      }
      catch (error) { return { success: false, error: error instanceof Error ? error : new AnalysisValidationError(["Invalid response."]) }; }
    },
  });
}

const kinds: Record<string, string> = {
  entity_type: "entityTypes", relationship_type: "relationshipTypes", action: "actions",
  selector: "selectors", variable: "variables", condition: "conditions", rule: "rules",
  path: "accessPaths", pattern: "accessPatterns", scenario: "scenarios", scenario_space: "scenarioSpaces", group: "groups",
};
const singleRefs: Record<string, string> = {
  entityTypeId: "entityTypes", recordEntityTypeId: "entityTypes", targetEntityTypeId: "entityTypes", createsEntityTypeId: "entityTypes",
  actorSelectorId: "selectors", targetSelectorId: "selectors", anchorSelectorId: "selectors",
  whereConditionId: "conditions", eligibilityConditionId: "conditions", conditionId: "conditions",
  variableId: "variables", actionId: "actions", ruleId: "rules", pathId: "accessPaths",
  scenarioSpaceId: "scenarioSpaces", scenarioId: "scenarios", defaultScenarioId: "scenarios", defaultPerspectiveId: "perspectives",
};
const arrayRefs: Record<string, string> = {
  claimIds: "claims", selectorIds: "selectors", relationshipTypeIds: "relationshipTypes", conditionIds: "conditions",
  varyingVariableIds: "variables", scenarioIds: "scenarios", implementedRuleIds: "rules", intendedRuleIds: "rules",
  pathIds: "accessPaths", scenarioSpaceIds: "scenarioSpaces", unresolvedConditionIds: "conditions",
  overviewPatternIds: "accessPatterns", defaultActionIds: "actions", overviewGroupIds: "groups",
};

function pointerExists(source: unknown, pointer: string): boolean {
  if (!pointer.startsWith("/") || /~(?![01])/.test(pointer)) return false;
  let value = source;
  for (const part of pointer.slice(1).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return false;
    value = (value as Record<string, unknown>)[key];
  }
  return value !== undefined && value !== null;
}

export function validateAuthorizationModel(value: unknown, prepared: PreparedAnalysis): AuthorizationModel {
  if (!validateShape(value)) {
    // Field locations and validator keywords only; never echo provider values.
    throw new AnalysisValidationError((validateShape.errors ?? []).map((error) => `Contract field ${error.instancePath || "/"}: ${error.keyword}.`));
  }
  const model = value;
  const issues: string[] = [];
  const check = (valid: unknown, message: string) => { if (!valid && issues.length < 24) issues.push(message); };
  check(model.modelId === prepared.modelId && model.snapshotRevision === prepared.snapshotRevision && model.contextRevision === prepared.contextRevision,
    "Response revisions and model ID must match requiredResponse.");
  const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);
  check(sameIds(model.coverage.analyzedObjectIds, prepared.includedIds), "coverage.analyzedObjectIds must match the included scope.");
  check(sameIds(model.coverage.externalDependencyIds, prepared.externalIds), "coverage.externalDependencyIds must match retained external evidence.");
  check(sameIds(model.coverage.exclusions.map((item) => item.sourceId), prepared.exclusions.map((item) => item.sourceId)), "coverage.exclusions must preserve the omitted object list.");
  check(model.materialization !== "observed", "Catalog metadata cannot establish observed instances or access.");
  const collections = {
    claims: model.claims, entityTypes: model.entityTypes, relationshipTypes: model.relationshipTypes, actions: model.actions,
    selectors: model.selectors, variables: model.variables, conditions: model.conditions, rules: model.rules,
    accessPaths: model.accessPaths, scenarios: model.scenarios, scenarioSpaces: model.scenarioSpaces, accessPatterns: model.accessPatterns,
    groups: model.presentation.groups, perspectives: model.presentation.perspectives,
  };
  const maps: Record<string, Set<string>> = Object.fromEntries(Object.entries(collections).map(([key, items]) => [key, new Set(items.map((item) => item.id))]));
  const excluded = new Set(prepared.exclusions.map((item) => item.sourceId));
  const seen = new Set<string>();
  function walk(item: unknown, path = "response") {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) { item.forEach((child, index) => walk(child, `${path}/${index}`)); return; }
    const record = item as Record<string, unknown>;
    const typedRef = Object.keys(record).length === 2 && typeof record.id === "string" && typeof record.kind === "string";
    if (typeof record.id === "string") {
      if (typedRef) check(maps[kinds[record.kind as string]]?.has(record.id), `${path}: typed reference does not resolve.`);
      else { check(!seen.has(record.id), `${path}: duplicate semantic ID.`); seen.add(record.id); }
    }
    for (const [key, child] of Object.entries(record)) {
      if (singleRefs[key] && child !== null) check(maps[singleRefs[key]]?.has(child as string), `${path}/${key}: reference does not resolve.`);
      if (arrayRefs[key]) for (const id of child as string[]) check(maps[arrayRefs[key]]?.has(id), `${path}/${key}: reference does not resolve.`);
      if (key === "sourceIds") for (const id of child as string[]) check(Object.hasOwn(prepared.evidenceRegistry, id), `${path}/sourceIds: source was not supplied.`);
      if (key === "sourceId") {
        check(Object.hasOwn(prepared.evidenceRegistry, child as string) || (path.startsWith("response/coverage/exclusions/") && excluded.has(child as string)), `${path}/sourceId: source was not supplied.`);
        if (typeof record.pointer === "string") check(pointerExists(prepared.evidenceRegistry[child as string], record.pointer), `${path}/pointer: evidence location does not resolve.`);
      }
      walk(child, `${path}/${key}`);
    }
  }
  walk(model);
  // Stop before dereferencing an invalid graph.
  if (issues.length) throw new AnalysisValidationError(issues);
  const entities = new Map(model.entityTypes.map((item) => [item.id, item]));
  const selectors = new Map(model.selectors.map((item) => [item.id, item]));
  const actions = new Map(model.actions.map((item) => [item.id, item]));
  const rules = new Map(model.rules.map((item) => [item.id, item]));
  const paths = new Map(model.accessPaths.map((item) => [item.id, item]));
  const claims = new Map(model.claims.map((item) => [item.id, item]));
  const conditions = new Map(model.conditions.map((item) => [item.id, item]));
  const variables = new Map(model.variables.map((item) => [item.id, item]));
  const scenarios = new Map(model.scenarios.map((item) => [item.id, item]));
  const spaces = new Map(model.scenarioSpaces.map((item) => [item.id, item]));
  const hasIntent = (ids: string[]) => ids.some((id) => claims.get(id)?.basis === "intended");
  for (const claim of model.claims) {
    check(claim.basis !== "test_observed", "Test observations require test evidence; none was supplied.");
    if (claim.basis === "intended") check(claim.evidenceRefs.some((ref) => prepared.contextSourceIds.includes(ref.sourceId)), "Intended claims require independent application context.");
    if (claim.basis === "implemented" && ["direct", "inferred"].includes(claim.support)) {
      check(claim.evidenceRefs.some((ref) => !prepared.contextSourceIds.includes(ref.sourceId)), "Implemented claims require catalog evidence.");
    }
  }
  const uniqueKeys = (keys: string[]) => new Set(keys).size === keys.length;
  for (const relationship of model.relationshipTypes) check(uniqueKeys(relationship.participants.map((item) => item.key)), "Relationship participant keys must be unique.");
  for (const selector of model.selectors) {
    check(selector.kind !== "observed_instance" && selector.instanceEvidenceRef === null, "Catalog metadata cannot establish an observed selector.");
    check(uniqueKeys(selector.contextBindings.map((item) => item.name)), "Selector context binding names must be unique.");
  }
  for (const rule of model.rules) {
    check(entities.get(selectors.get(rule.actorSelectorId)!.entityTypeId)!.capabilities.includes("actor"), "Rule actors must have actor capability.");
    check(selectors.get(rule.targetSelectorId)!.entityTypeId === actions.get(rule.actionId)!.targetEntityTypeId, "Rule target and action entity types must agree.");
    if (rule.basis === "intended") check(hasIntent(rule.claimIds), "Intended rules require independent intended claims.");
  }
  const done = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) { check(false, "Conditions must form an acyclic graph."); return; }
    if (done.has(id)) return;
    visiting.add(id);
    const node = conditions.get(id)!;
    if (node.kind === "all" || node.kind === "any") node.conditionIds.forEach(visit);
    if (node.kind === "not") visit(node.conditionId);
    visiting.delete(id); done.add(id);
  }
  model.conditions.forEach((item) => visit(item.id));
  const validValue = (id: string, value: Scalar) => {
    const variable = variables.get(id)!;
    return (value === null ? variable.nullable : typeof value === variable.valueType) && (!variable.choices.length || variable.choices.some((choice) => choice.value === value));
  };
  for (const variable of model.variables) {
    check(uniqueKeys(variable.choices.map((choice) => JSON.stringify(choice.value))), "Variable choices must have unique values.");
    check(variable.choices.every((choice) => choice.value === null ? variable.nullable : typeof choice.value === variable.valueType), "Variable choices must match its declared type.");
  }
  for (const node of model.conditions) if (node.kind === "compare") {
    check(node.values.every((value) => validValue(node.variableId, value)), "Condition comparison values must match the variable domain.");
    check(!["eq", "ne"].includes(node.operator) || node.values.length === 1, "Equality comparisons must contain exactly one value.");
  }
  function facts(items: ScenarioFact[]) {
    check(uniqueKeys(items.map((item) => item.variableId)), "Scenario facts must not repeat a variable.");
    for (const item of items) {
      check(validValue(item.variableId, item.value), "Scenario fact must match the variable domain.");
      check(item.basis === "assumed", "Catalog metadata does not supply observed scenario facts.");
    }
  }
  for (const scenario of model.scenarios) { check(scenario.kind !== "observed", "Scenario observations were not supplied."); facts(scenario.facts); }
  for (const space of model.scenarioSpaces) {
    facts(space.fixedFacts);
    check(space.fixedFacts.every((fact) => !space.varyingVariableIds.includes(fact.variableId)), "Fixed and varying scenario variables must be disjoint.");
    const fixed = new Map(space.fixedFacts.map((item) => [item.variableId, item.value]));
    for (const id of space.scenarioIds) {
      const scenario = scenarios.get(id)!;
      check(scenario.actorSelectorId === space.actorSelectorId && scenario.targetSelectorId === space.targetSelectorId, "Scenario selectors must match their scenario space.");
      check(scenario.facts.every((fact) => !fixed.has(fact.variableId) || fixed.get(fact.variableId) === fact.value), "Scenario facts must not contradict fixed facts.");
      check(scenario.facts.every((fact) => fixed.has(fact.variableId) || space.varyingVariableIds.includes(fact.variableId)), "Scenario facts must belong to fixed or varying variables.");
    }
  }
  for (const facet of model.facets) check(facet.defaultOptionIds.every((id) => facet.options.some((option) => option.id === id)), "Facet defaults must reference their own options.");
  for (const control of model.scenarioControls) {
    check(control.options.every((option) => validValue(control.variableId, option.value)), "Simulation options must match the variable domain.");
    check(control.scenarioSpaceIds.every((id) => spaces.get(id)!.varyingVariableIds.includes(control.variableId)), "Simulation controls may only change varying variables.");
  }
  if (issues.length) throw new AnalysisValidationError(issues);
  for (const pattern of model.accessPatterns) {
    const space = spaces.get(pattern.scenarioSpaceId)!;
    check(pattern.currentEvaluationId === null, "Schema-only analysis must not claim a current user access decision.");
    check(pattern.actorSelectorId === space.actorSelectorId && pattern.targetSelectorId === space.targetSelectorId, "Pattern selectors must match the scenario space.");
    for (const [basis, ids] of [["implemented", pattern.implementedRuleIds], ["intended", pattern.intendedRuleIds]] as const) {
      for (const id of ids) {
        const rule = rules.get(id)!;
        check(rule.basis === basis && rule.actionId === pattern.actionId, "Pattern rules must match their basis and action.");
        check(selectors.get(rule.actorSelectorId)!.entityTypeId === selectors.get(pattern.actorSelectorId)!.entityTypeId &&
          selectors.get(rule.targetSelectorId)!.entityTypeId === selectors.get(pattern.targetSelectorId)!.entityTypeId, "Pattern and rule selector types must agree.");
      }
    }
    for (const id of pattern.pathIds) check(pattern.implementedRuleIds.includes(paths.get(id)!.ruleId), "Pattern paths must belong to its implemented rules.");
    for (const evaluation of pattern.evaluations) {
      check(space.scenarioIds.includes(evaluation.scenarioId), "Evaluation scenario must belong to the pattern's scenario space.");
      const scenario = scenarios.get(evaluation.scenarioId)!;
      const factMap = new Map([...space.fixedFacts, ...scenario.facts].map((fact) => [fact.variableId, fact.value]));
      const symbolic = createSymbolicEvaluator(model, factMap);
      for (const [basis, decision] of [["implemented", evaluation.implemented], ["intended", evaluation.intended]] as const) {
        if (!decision) continue;
        check(!["runtime_observation", "test_evidence"].includes(decision.method), "Runtime or test decisions require evidence not supplied by introspection.");
        const ruleIds = basis === "implemented" ? pattern.implementedRuleIds : pattern.intendedRuleIds;
        if (basis === "intended") check(ruleIds.length > 0, "Intended decisions require intended rules.");
        if (decision.method === "symbolic_derivation") {
          const result = symbolic.rules(ruleIds);
          check(decision.outcome === (result === null ? "unknown" : result ? "allowed" : "denied"), "Symbolic decision disagrees with its rule conditions and supplied facts.");
        }
        check(uniqueKeys(decision.pathStates.map((state) => state.pathId)), "A decision must not repeat path states.");
        for (const state of decision.pathStates) {
          check(pattern.pathIds.includes(state.pathId), "Decision path must belong to the pattern.");
          if (decision.method === "symbolic_derivation") {
            const path = paths.get(state.pathId)!;
            const result = all([symbolic.rule(path.ruleId), symbolic.condition(path.eligibilityConditionId)]);
            check(state.state === (result === null ? "unknown" : result ? "satisfied" : "unsatisfied"), "Symbolic path state disagrees with its parent rule and path conditions.");
          }
        }
      }
    }
    if (["always", "never"].includes(pattern.classification)) {
      // A few sampled scenarios cannot prove a universal statement. In this
      // initial pipeline only an unconditional symbolic proof is accepted.
      const proof = createSymbolicEvaluator(model, new Map(space.fixedFacts.map((fact) => [fact.variableId, fact.value]))).rules(pattern.implementedRuleIds);
      check(pattern.completeness === "complete" && pattern.implementedRuleIds.every((id) => rules.get(id)!.coverage === "complete") &&
        proof === (pattern.classification === "always"), "Always/never requires complete rules and a proof over the entire declared boundary; otherwise use unknown or conditional.");
    }
    if (pattern.classification === "conditional") {
      const witnesses = pattern.evaluations.filter((item) => item.implemented.method === "symbolic_derivation").map((item) => item.implemented.outcome);
      check(witnesses.includes("allowed") && witnesses.includes("denied"), "Conditional classification requires both allowed and denied symbolic witnesses within its scenario space; otherwise use unknown.");
    }
  }
  for (const finding of model.findings) if (finding.kind === "intent_mismatch") check(hasIntent(finding.claimIds), "Intent mismatch findings require independent intended evidence.");
  if (issues.length) throw new AnalysisValidationError(issues);
  return model;
}
