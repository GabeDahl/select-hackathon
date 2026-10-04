import type { AuthorizationModel, Pattern } from "./authorization-model-types.ts";
import { all, createSymbolicEvaluator } from "./authorization-evaluation.ts";
import type { ScopedAccess, SceneAccessLevel, SceneComplexity } from "./scene-graph-types.ts";

/** Selected scenarios are simulations. No scenario means observed current evidence only. */
export function resolvePatternAccess(model: AuthorizationModel, pattern: Pattern, requestedScenarioId: string | null): ScopedAccess {
  const current = requestedScenarioId === null ? pattern.evaluations.find((evaluation) => evaluation.id === pattern.currentEvaluationId) : null;
  const scenarioId = requestedScenarioId ?? current?.scenarioId ?? null;
  const scenario = model.scenarios.find((scenario) => scenario.id === scenarioId);
  const space = model.scenarioSpaces.find((space) => space.id === pattern.scenarioSpaceId);
  const result: ScopedAccess = { patternId: pattern.id, actionId: pattern.actionId, scenarioId,
    scenarioKind: scenario?.kind ?? null, outcome: "unknown", method: null,
    pathStates: pattern.pathIds.map((pathId) => ({ pathId, state: "unknown" })), unresolvedConditionIds: [] };
  if (!scenario || !space?.scenarioIds.includes(scenario.id) || scenario.actorSelectorId !== pattern.actorSelectorId ||
    scenario.targetSelectorId !== pattern.targetSelectorId || (requestedScenarioId === null && scenario.kind !== "observed")) return result;
  const supplied = current ?? pattern.evaluations.find((evaluation) => evaluation.scenarioId === scenario.id);
  if (supplied) {
    // Model inference is retained as provenance, but cannot paint a verified permission.
    const decision = supplied.implemented;
    return { ...result, outcome: decision.method === "model_inference" ? "unknown" : decision.outcome, method: decision.method,
      pathStates: result.pathStates.map(({ pathId }) => ({ pathId, state: decision.method === "model_inference" ? "unknown"
        : decision.pathStates.find((state) => state.pathId === pathId)?.state ?? "unknown" })),
      unresolvedConditionIds: decision.unresolvedConditionIds };
  }
  // Derive only explicitly selected, scoped facts through the existing safe evaluator.
  const facts = new Map([...space.fixedFacts, ...scenario.facts].map((fact) => [fact.variableId, fact.value]));
  const evaluator = createSymbolicEvaluator(model, facts);
  const value = evaluator.rules(pattern.implementedRuleIds);
  const complete = pattern.completeness === "complete" && pattern.implementedRuleIds.length > 0 &&
    pattern.implementedRuleIds.every((id) => model.rules.find((rule) => rule.id === id)?.coverage === "complete");
  const relevantConditions = new Set<string>();
  const collect = (id: string) => {
    if (relevantConditions.has(id)) return;
    relevantConditions.add(id);
    const node = model.conditions.find((condition) => condition.id === id);
    if (node?.kind === "all" || node?.kind === "any") node.conditionIds.forEach(collect);
    if (node?.kind === "not") collect(node.conditionId);
  };
  for (const id of pattern.implementedRuleIds) {
    const rule = model.rules.find((rule) => rule.id === id);
    if (rule) collect(rule.eligibilityConditionId);
  }
  for (const id of pattern.pathIds) {
    const path = model.accessPaths.find((path) => path.id === id);
    if (path) collect(path.eligibilityConditionId);
  }
  for (const id of [pattern.actorSelectorId, pattern.targetSelectorId]) {
    const selector = model.selectors.find((selector) => selector.id === id);
    if (selector?.whereConditionId) collect(selector.whereConditionId);
  }
  return { ...result, outcome: complete ? value === true ? "allowed" : value === false ? "denied" : "unknown" : "unknown",
    method: "symbolic_derivation",
    pathStates: pattern.pathIds.map((pathId) => {
      const path = model.accessPaths.find((path) => path.id === pathId);
      const truth = path && pattern.implementedRuleIds.includes(path.ruleId)
        ? all([evaluator.rule(path.ruleId), evaluator.condition(path.eligibilityConditionId)]) : null;
      return { pathId, state: truth === false ? "unsatisfied" : truth === true && complete ? "satisfied" : "unknown" };
    }),
    unresolvedConditionIds: [...relevantConditions].filter((id) => evaluator.condition(id) === null),
  };
}

/** Full/none apply only to ALL declared actions; missing action analysis is unknown. */
export function summarizeAccess(evaluations: ScopedAccess[], actionIds: string[]): SceneAccessLevel {
  if (!actionIds.length || !evaluations.length) return "unknown";
  const outcomes = actionIds.map((id) => {
    const values = evaluations.filter((evaluation) => evaluation.actionId === id);
    // Different selectors/scenario boundaries are not interchangeable OR branches.
    return !values.length || values.some((value) => value.outcome === "unknown") ? "unknown"
      : values.every((value) => value.outcome === "allowed") ? "allowed"
      : values.every((value) => value.outcome === "denied") ? "denied" : "unknown";
  });
  if (outcomes.includes("unknown")) return "unknown";
  if (outcomes.every((outcome) => outcome === "allowed")) return "full";
  if (outcomes.every((outcome) => outcome === "denied")) return "none";
  return "limited";
}

export function resourceComplexity(patterns: Pattern[]): SceneComplexity {
  if (!patterns.length || patterns.some((pattern) => pattern.completeness !== "complete" || pattern.classification === "unknown")) return "unresolved";
  return patterns.some((pattern) => pattern.classification === "conditional") ? "conditional" : "straightforward";
}
