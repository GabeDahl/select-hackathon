import type { AuthorizationModel, TargetRef } from "./authorization-model-types.ts";
import { createModelNavigationRegistry } from "./explorer-navigation.ts";
import { semanticTargetKey, uniqueRefs, type SemanticEntity, type SemanticGraph } from "./scene-graph-types.ts";

/** No geometry, inferred relationship instances, or permission decisions. */
export function compileSemanticGraph(model: AuthorizationModel): SemanticGraph {
  const registry = createModelNavigationRegistry(model);
  const targetPatternIds = new Map(registry.entries.map((entry) => [semanticTargetKey(entry.target), entry.patternIds]));
  const types = new Map(model.entityTypes.map((type) => [type.id, type]));
  const entities = new Map<string, SemanticEntity>();
  const representedTypes = new Set<string>();
  for (const selector of model.selectors) {
    const entityType = types.get(selector.entityTypeId);
    if (!entityType) continue;
    const target: TargetRef = { kind: "selector", id: selector.id };
    const groups = model.presentation.groups.filter((group) => group.selectorIds.includes(selector.id));
    entities.set(selector.id, {
      id: selector.id, target, label: selector.label, selector, entityType,
      refs: [target, { kind: "entity_type", id: entityType.id }, ...groups.map((group): TargetRef => ({ kind: "group", id: group.id }))],
      patternIds: targetPatternIds.get(semanticTargetKey(target)) ?? [],
    });
    representedTypes.add(entityType.id);
  }
  // A type representative is explicitly a type, never an invented row or selector.
  for (const type of model.entityTypes) {
    if (representedTypes.has(type.id) || !type.capabilities.some((capability) => ["actor", "resource", "context"].includes(capability))) continue;
    const target: TargetRef = { kind: "entity_type", id: type.id };
    entities.set(type.id, { id: type.id, target, label: type.label, entityType: type, selector: null,
      refs: [target], patternIds: targetPatternIds.get(semanticTargetKey(target)) ?? [] });
  }
  const conditions = new Map(model.conditions.map((condition) => [condition.id, condition]));
  const conditionRefs = new Map<string, TargetRef[]>();
  const collect = (id: string, visited = new Set<string>()): TargetRef[] => {
    if (conditionRefs.has(id)) return conditionRefs.get(id)!;
    if (visited.has(id)) return [];
    visited.add(id);
    const condition = conditions.get(id);
    const refs: TargetRef[] = [{ kind: "condition", id }];
    if (condition?.kind === "compare") refs.push({ kind: "variable", id: condition.variableId });
    if (condition?.kind === "all" || condition?.kind === "any") {
      for (const child of condition.conditionIds) refs.push(...collect(child, new Set(visited)));
    }
    if (condition?.kind === "not") refs.push(...collect(condition.conditionId, new Set(visited)));
    const result = uniqueRefs(refs);
    conditionRefs.set(id, result);
    return result;
  };
  model.conditions.forEach((condition) => collect(condition.id));
  return { model, entities, patterns: new Map(model.accessPatterns.map((pattern) => [pattern.id, pattern])), targetPatternIds, conditionRefs };
}
