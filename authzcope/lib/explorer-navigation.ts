import type { AuthorizationModel, TargetRef } from "./authorization-model-types.ts";
import type { ExplorerNavigation, NavigationBatch, NavigationEntry, NavigationRegistry, NavigationResult } from "./explorer-navigation-types.ts";

export const initialExplorerNavigation: ExplorerNavigation = {
  perspective: "user", view: "overview", focus: null, highlighted: [], inspected: null, patternId: null, scenarioIds: [],
};
export const emptyNavigationRegistry: NavigationRegistry = {
  revision: "authzcope.explorer.empty", mode: "empty", entries: [], patterns: [],
};
export const targetKey = (target: TargetRef) => `${target.kind}:${target.id}`;
export const sameTarget = (a: TargetRef | null, b: TargetRef | null) => a === b || (!!a && !!b && targetKey(a) === targetKey(b));

/** The registry contains semantics, never world positions or renderer object names. */
export function createModelNavigationRegistry(model: AuthorizationModel): NavigationRegistry {
  const entries: NavigationEntry[] = [];
  const add = (kind: TargetRef["kind"], items: { id: string; label?: string }[]) => {
    for (const item of items) entries.push({ target: { kind, id: item.id }, label: item.label ?? item.id, patternIds: [] });
  };
  add("entity_type", model.entityTypes); add("relationship_type", model.relationshipTypes);
  add("action", model.actions); add("selector", model.selectors); add("variable", model.variables);
  add("condition", model.conditions); add("rule", model.rules); add("path", model.accessPaths);
  add("pattern", model.accessPatterns); add("scenario", model.scenarios); add("scenario_space", model.scenarioSpaces);
  add("group", model.presentation.groups);
  const byKey = new Map(entries.map((entry) => [targetKey(entry.target), entry]));
  const conditions = new Map(model.conditions.map((item) => [item.id, item]));
  const link = (kind: TargetRef["kind"], id: string, patternId: string) => {
    const entry = byKey.get(targetKey({ kind, id }));
    if (entry && !entry.patternIds.includes(patternId)) entry.patternIds.push(patternId);
  };
  const patterns = model.accessPatterns.map((pattern) => {
    const linkCondition = (id: string, visited = new Set<string>()) => {
      if (visited.has(id)) return;
      visited.add(id); link("condition", id, pattern.id);
      const condition = conditions.get(id);
      if (condition?.kind === "all" || condition?.kind === "any") condition.conditionIds.forEach((id) => linkCondition(id, visited));
      if (condition?.kind === "not") linkCondition(condition.conditionId, visited);
      if (condition?.kind === "compare") link("variable", condition.variableId, pattern.id);
    };
    link("pattern", pattern.id, pattern.id); link("action", pattern.actionId, pattern.id);
    for (const id of [pattern.actorSelectorId, pattern.targetSelectorId]) {
      link("selector", id, pattern.id);
      const selector = model.selectors.find((item) => item.id === id);
      if (selector) { link("entity_type", selector.entityTypeId, pattern.id); if (selector.whereConditionId) linkCondition(selector.whereConditionId); }
    }
    for (const id of [...pattern.implementedRuleIds, ...pattern.intendedRuleIds]) {
      link("rule", id, pattern.id);
      const rule = model.rules.find((item) => item.id === id);
      if (rule) linkCondition(rule.eligibilityConditionId);
    }
    for (const id of pattern.pathIds) {
      link("path", id, pattern.id);
      const path = model.accessPaths.find((item) => item.id === id);
      if (path) {
        path.relationshipTypeIds.forEach((id) => link("relationship_type", id, pattern.id));
        path.selectorIds.forEach((id) => link("selector", id, pattern.id));
        linkCondition(path.eligibilityConditionId);
      }
    }
    const space = model.scenarioSpaces.find((item) => item.id === pattern.scenarioSpaceId);
    link("scenario_space", pattern.scenarioSpaceId, pattern.id);
    space?.scenarioIds.forEach((id) => link("scenario", id, pattern.id));
    model.presentation.groups.filter((group) => group.selectorIds.some((id) => [pattern.actorSelectorId, pattern.targetSelectorId].includes(id)))
      .forEach((group) => link("group", group.id, pattern.id));
    return { id: pattern.id, actor: { kind: "selector" as const, id: pattern.actorSelectorId },
      resource: { kind: "selector" as const, id: pattern.targetSelectorId }, scenarioIds: space?.scenarioIds ?? [] };
  });
  return { revision: JSON.stringify([model.modelId, model.snapshotRevision, model.contextRevision]), mode: "analysis", entries, patterns };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));

/** Pure atomic reducer: reject the entire batch before anything reaches the scene. */
export function applyNavigationBatch(registry: NavigationRegistry, current: ExplorerNavigation, value: unknown): NavigationResult {
  const fail = (message = "The navigation response contains an invalid command or unavailable target."): NavigationResult => ({ ok: false, message });
  if (!object(value) || !keys(value, ["revision", "commands"]) || value.revision !== registry.revision) return fail("This navigation response belongs to an older model. Ask again with the current model.");
  if (!Array.isArray(value.commands) || value.commands.length > 8) return fail();
  const entries = new Map(registry.entries.map((entry) => [targetKey(entry.target), entry]));
  const resolve = (target: unknown) => object(target) && keys(target, ["kind", "id"]) && typeof target.kind === "string" && typeof target.id === "string"
    ? entries.get(targetKey(target as TargetRef)) : undefined;
  let next: ExplorerNavigation = { ...current, highlighted: [...current.highlighted], scenarioIds: [...current.scenarioIds] };
  for (const command of value.commands) {
    if (!object(command)) return fail();
    switch (command.type) {
      case "overview":
        if (!keys(command, ["type"])) return fail();
        next = { ...initialExplorerNavigation }; break;
      case "perspective":
        if (!keys(command, ["type", "perspective"]) || !["user", "resource"].includes(command.perspective as string)) return fail();
        next = { ...next, perspective: command.perspective as "user" | "resource" }; break;
      case "focus": case "inspect": {
        if (!keys(command, ["type", "target"])) return fail();
        const entry = resolve(command.target); if (!entry) return fail();
        // Keep the current action if applicable; never arbitrarily choose between actions.
        const patternId = next.patternId && entry.patternIds.includes(next.patternId) ? next.patternId
          : entry.patternIds.length === 1 ? entry.patternIds[0] : null;
        next = { ...next, perspective: registry.patterns.some((pattern) => sameTarget(pattern.actor, entry.target)) ? "user" : "resource",
          view: "focus", focus: entry.target, inspected: entry.target, patternId,
          highlighted: command.type === "focus" ? [] : [entry.target], scenarioIds: entry.target.kind === "scenario" && patternId ? [entry.target.id] : [] };
        break;
      }
      case "highlight": {
        if (!keys(command, ["type", "targets"]) || !Array.isArray(command.targets) || command.targets.length > 32) return fail();
        const resolved = command.targets.map(resolve); if (resolved.some((entry) => !entry)) return fail();
        const targets = resolved.map((entry) => entry!.target);
        if (new Set(targets.map(targetKey)).size !== targets.length) return fail();
        // Highlight only paths/rules/scenarios relevant to an explicitly selected action.
        if (next.patternId && resolved.some((entry) => ["path", "rule", "scenario", "scenario_space"].includes(entry!.target.kind) && !entry!.patternIds.includes(next.patternId!))) return fail();
        next = { ...next, highlighted: targets }; break;
      }
      case "compare": {
        if (!keys(command, ["type", "patternId", "scenarioIds"]) || typeof command.patternId !== "string" || !Array.isArray(command.scenarioIds)) return fail();
        const pattern = registry.patterns.find((item) => item.id === command.patternId);
        const ids = command.scenarioIds;
        if (!pattern || ids.length < 1 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string" || !pattern.scenarioIds.includes(id))) return fail("Compare scenarios from the same access pattern, using one to four existing scenario IDs.");
        next = { ...next, perspective: "resource", view: ids.length === 1 ? "focus" : "compare", focus: pattern.resource,
          inspected: { kind: "pattern", id: pattern.id }, patternId: pattern.id, scenarioIds: ids as string[], highlighted: [] };
        break;
      }
      default: return fail();
    }
  }
  // A later focus must not leave highlights from an unrelated action behind.
  if (next.patternId && next.highlighted.some((target) => ["path", "rule", "scenario", "scenario_space"].includes(target.kind) && !entries.get(targetKey(target))?.patternIds.includes(next.patternId!))) return fail();
  return { ok: true, navigation: next };
}

export function navigationBatch(registry: NavigationRegistry, commands: NavigationBatch["commands"]): NavigationBatch {
  return { revision: registry.revision, commands };
}
