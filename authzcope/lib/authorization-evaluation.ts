import type { AuthorizationModel, Scalar } from "./authorization-model-types.ts";

export type Truth = boolean | null;
export const all = (values: Truth[]): Truth => values.includes(false) ? false : values.includes(null) ? null : true;
export const any = (values: Truth[]): Truth => values.includes(true) ? true : values.includes(null) ? null : false;

// Evaluates the supplied symbolic model, never a live database permission check.
// Missing facts and SQL that cannot be represented remain unknown.
export function createSymbolicEvaluator(model: AuthorizationModel, facts: Map<string, Scalar>) {
  const conditions = new Map(model.conditions.map((condition) => [condition.id, condition]));
  const selectors = new Map(model.selectors.map((selector) => [selector.id, selector]));
  const rules = new Map(model.rules.map((rule) => [rule.id, rule]));
  const cache = new Map<string, Truth>();
  const visiting = new Set<string>();
  function condition(id: string): Truth {
    if (cache.has(id)) return cache.get(id)!;
    const node = conditions.get(id);
    if (!node || visiting.has(id)) return null;
    visiting.add(id);
    let result: Truth;
    switch (node.kind) {
      case "constant": result = node.value; break;
      case "opaque": result = null; break;
      case "compare": {
        if (!facts.has(node.variableId)) { result = null; break; }
        const value = facts.get(node.variableId)!;
        result = node.operator === "eq" ? value === node.values[0]
          : node.operator === "ne" ? value !== node.values[0]
          : node.operator === "in" ? node.values.includes(value) : !node.values.includes(value);
        break;
      }
      case "not": { const value = condition(node.conditionId); result = value === null ? null : !value; break; }
      case "all": result = all(node.conditionIds.map(condition)); break;
      case "any": result = any(node.conditionIds.map(condition)); break;
    }
    visiting.delete(id); cache.set(id, result);
    return result;
  }
  function selector(id: string): Truth {
    const value = selectors.get(id);
    return value ? value.whereConditionId ? condition(value.whereConditionId) : true : null;
  }
  function rule(id: string): Truth {
    const value = rules.get(id);
    return value ? all([selector(value.actorSelectorId), selector(value.targetSelectorId), condition(value.eligibilityConditionId)]) : null;
  }
  return { condition, rule, rules: (ids: string[]): Truth => ids.length ? any(ids.map(rule)) : null };
}
