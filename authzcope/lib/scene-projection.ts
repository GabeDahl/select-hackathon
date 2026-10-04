import type { Pattern, TargetRef } from "./authorization-model-types.ts";
import type { ExplorerNavigation } from "./explorer-navigation-types.ts";
import { resolvePatternAccess, resourceComplexity, summarizeAccess } from "./scene-access.ts";
import { semanticTargetKey, uniqueRefs, type SemanticEntity, type SemanticGraph, type SceneEdge, type SceneNode, type ScenePanel, type SceneProjection } from "./scene-graph-types.ts";

const ref = (kind: TargetRef["kind"], id: string): TargetRef => ({ kind, id });
const stableId = (...parts: string[]) => JSON.stringify(parts);

/** Visibility never edits facts, rules, or evaluations. Navigation carries semantic IDs. */
export function projectScene(graph: SemanticGraph, navigation: ExplorerNavigation): SceneProjection {
  const { model } = graph;
  const highlighted = new Set(navigation.highlighted.map(semanticTargetKey));
  const highlights = (refs: TargetRef[]) => refs.some((value) => highlighted.has(semanticTargetKey(value)));
  const selected = navigation.focus ? semanticTargetKey(navigation.focus) : null;
  const selectedPattern = navigation.patternId ? graph.patterns.get(navigation.patternId) : undefined;
  const focusEntity = navigation.focus && ["selector", "entity_type"].includes(navigation.focus.kind)
    ? graph.entities.get(navigation.focus.id) : undefined;
  const focusPatterns = navigation.focus ? graph.targetPatternIds.get(semanticTargetKey(navigation.focus)) ?? [] : [];
  const overviewIds = model.presentation.overviewPatternIds;
  let patterns = selectedPattern ? [selectedPattern] : focusPatterns.length
    ? model.accessPatterns.filter((pattern) => focusPatterns.includes(pattern.id))
    : overviewIds.length && navigation.view === "overview" ? model.accessPatterns.filter((pattern) => overviewIds.includes(pattern.id)) : model.accessPatterns;
  const defaultActions = model.presentation.defaultActionIds;
  if (!navigation.focus && navigation.view === "overview" && defaultActions.length) patterns = patterns.filter((pattern) => defaultActions.includes(pattern.actionId));
  const perspective = model.presentation.perspectives.find((perspective) => perspective.kind === (navigation.perspective === "user" ? "actor" : "resource"))
    ?? model.presentation.perspectives.find((perspective) => perspective.id === model.presentation.defaultPerspectiveId);
  const defaultAnchor = perspective ? graph.entities.get(perspective.anchorSelectorId) : undefined;
  const firstActor = [...graph.entities.values()].find((entity) => entity.entityType.capabilities.includes("actor"));
  const firstResource = [...graph.entities.values()].find((entity) => entity.entityType.capabilities.includes("resource"));
  const uniqueTargets = [...new Set(patterns.map((pattern) => pattern.targetSelectorId))];
  const focusIsTarget = !!focusEntity && patterns.some((pattern) => pattern.targetSelectorId === focusEntity.id);
  const resourceFocus = navigation.perspective === "resource" || !!selectedPattern ||
    (navigation.view !== "overview" && (focusIsTarget || (!!focusEntity && !focusEntity.entityType.capabilities.includes("actor")) ||
      (!focusEntity && focusPatterns.length > 0 && uniqueTargets.length === 1)));
  const resource = selectedPattern ? graph.entities.get(selectedPattern.targetSelectorId)
    : resourceFocus && focusEntity ? focusEntity
    : resourceFocus && navigation.view !== "overview" && uniqueTargets.length === 1 ? graph.entities.get(uniqueTargets[0])
    : defaultAnchor?.entityType.capabilities.includes("resource") && navigation.perspective === "resource" ? defaultAnchor
    : graph.entities.get(patterns[0]?.targetSelectorId ?? "") ?? firstResource;
  const actor = selectedPattern ? graph.entities.get(selectedPattern.actorSelectorId)
    : !resourceFocus && focusEntity?.entityType.capabilities.includes("actor") ? focusEntity
    : defaultAnchor?.entityType.capabilities.includes("actor") && navigation.perspective === "user" ? defaultAnchor
    : graph.entities.get(patterns[0]?.actorSelectorId ?? "") ?? firstActor;
  patterns = patterns.filter((pattern) => resourceFocus ? pattern.targetSelectorId === resource?.id : pattern.actorSelectorId === actor?.id);

  const patternRefs = (values: Pattern[]): TargetRef[] => uniqueRefs(values.flatMap((pattern) => [
    ref("pattern", pattern.id), ref("action", pattern.actionId), ref("scenario_space", pattern.scenarioSpaceId),
    ...[pattern.actorSelectorId, pattern.targetSelectorId].flatMap((id) => {
      const conditionId = graph.entities.get(id)?.selector?.whereConditionId;
      return conditionId ? graph.conditionRefs.get(conditionId) ?? [] : [];
    }),
    ...[...pattern.implementedRuleIds, ...pattern.intendedRuleIds].flatMap((id) => {
      const rule = model.rules.find((rule) => rule.id === id);
      return [ref("rule", id), ...(rule ? graph.conditionRefs.get(rule.eligibilityConditionId) ?? [] : [])];
    }),
  ]));

  function panel(scenarioId: string | null): ScenePanel {
    const focused = navigation.view !== "overview" && resourceFocus && !!resource;
    const anchor = resourceFocus ? resource : actor;
    const id = stableId(focused ? "paths" : "fan", navigation.perspective, anchor?.id ?? "empty", scenarioId ?? "current");
    const nodes: SceneNode[] = [], edges: SceneEdge[] = [];
    const scopeRefs = scenarioId ? [ref("scenario", scenarioId)] : [];
    function entityNode(entity: SemanticEntity, role: "actor" | "resource", relevant: Pattern[]) {
      const instanceId = stableId(id, role, entity.id);
      const existing = nodes.find((node) => node.instanceId === instanceId);
      if (existing) return existing;
      const refs = uniqueRefs([...entity.refs, ...patternRefs(relevant), ...scopeRefs]);
      const node: SceneNode = { instanceId, semanticId: entity.id, target: entity.target, refs, role, label: entity.label,
        materialization: entity.selector?.kind ?? "type", complexity: resourceComplexity(relevant),
        highlighted: highlights(refs), selected: !!selected && entity.refs.some((value) => semanticTargetKey(value) === selected) };
      nodes.push(node);
      return node;
    }
    const anchorNode = anchor ? entityNode(anchor, resourceFocus ? "resource" : "actor", patterns) : null;
    function accessEdge(from: SceneNode, to: SceneNode, values: Pattern[]) {
      const actionIds = [...new Set(selectedPattern ? [selectedPattern.actionId] :
        !navigation.focus && defaultActions.length ? defaultActions : values.map((pattern) => pattern.actionId))];
      const evaluations = values.map((pattern) => resolvePatternAccess(model, pattern, scenarioId));
      const refs = uniqueRefs([from.target, to.target, ...patternRefs(values), ...scopeRefs]);
      edges.push({ instanceId: stableId(id, "access", from.instanceId, to.instanceId), fromId: from.instanceId, toId: to.instanceId,
        kind: "effective_access", actionIds, access: summarizeAccess(evaluations, actionIds), evaluations, refs, highlighted: highlights(refs) });
    }
    if (focused && resource && anchorNode) {
      const actors = [...new Set(patterns.map((pattern) => pattern.actorSelectorId))].map((id) => graph.entities.get(id)).filter((entity): entity is SemanticEntity => !!entity);
      if (!actors.length && actor) actors.push(actor);
      for (const actor of actors) {
        const relevant = patterns.filter((pattern) => pattern.actorSelectorId === actor.id);
        const actorNode = entityNode(actor, "actor", relevant);
        let pathCount = 0;
        for (const pattern of relevant) {
          const evaluation = resolvePatternAccess(model, pattern, scenarioId);
          for (const pathId of pattern.pathIds) {
            const path = model.accessPaths.find((path) => path.id === pathId);
            // Intended paths have no implemented evaluation and are not painted as grants.
            if (!path || !pattern.implementedRuleIds.includes(path.ruleId)) continue;
            const rule = model.rules.find((rule) => rule.id === path.ruleId);
            const refs = uniqueRefs([actorNode.target, anchorNode.target, ref("path", path.id), ref("rule", path.ruleId), ref("pattern", pattern.id), ref("action", pattern.actionId),
              ...(graph.conditionRefs.get(path.eligibilityConditionId) ?? []),
              ...(rule ? graph.conditionRefs.get(rule.eligibilityConditionId) ?? [] : []),
              ...path.relationshipTypeIds.map((id) => ref("relationship_type", id)), ...scopeRefs]);
            const pathNode: SceneNode = { instanceId: stableId(id, "path", pattern.id, path.id), semanticId: path.id, target: ref("path", path.id),
              refs, role: "path", label: path.label, materialization: "explanation", complexity: "unresolved",
              highlighted: highlights(refs), selected: selected === semanticTargetKey(ref("path", path.id)) };
            nodes.push(pathNode);
            const state = evaluation.pathStates.find((state) => state.pathId === path.id)?.state ?? "unknown";
            const access = state === "satisfied" ? "full" : state === "unsatisfied" ? "none" : "unknown";
            for (const [from, to] of [[actorNode, pathNode], [pathNode, anchorNode]]) {
              edges.push({ instanceId: stableId(pathNode.instanceId, from.instanceId, to.instanceId), fromId: from.instanceId, toId: to.instanceId,
                kind: "path_explanation", actionIds: [pattern.actionId], access, evaluations: [evaluation], refs, highlighted: highlights(refs) });
            }
            pathCount++;
          }
        }
        // Rules may be modeled without an explanatory path. Keep their effective result visible.
        if (!pathCount) accessEdge(actorNode, anchorNode, relevant);
      }
    } else {
      const counterpartIds = new Set(patterns.map((pattern) => resourceFocus ? pattern.actorSelectorId : pattern.targetSelectorId));
      if (!resourceFocus && !navigation.focus) {
        const groups = model.presentation.groups.filter((group) => model.presentation.overviewGroupIds.includes(group.id));
        groups.forEach((group) => group.selectorIds.forEach((id) => counterpartIds.add(id)));
        // The root lists every modeled resource, including resources whose
        // access is unknown for the overview actor. Actor-specific patterns
        // determine connection states, not whether a resource exists.
        for (const entity of graph.entities.values()) {
          if (entity.entityType.capabilities.includes("resource")) counterpartIds.add(entity.id);
        }
      }
      if (!resourceFocus && navigation.focus?.kind === "group") {
        model.presentation.groups.find((group) => group.id === navigation.focus?.id)?.selectorIds.forEach((id) => counterpartIds.add(id));
      }
      if (focusEntity && focusEntity.id !== anchor?.id) counterpartIds.add(focusEntity.id);
      const counterparts = [...counterpartIds].sort().map((id) => graph.entities.get(id)).filter((entity): entity is SemanticEntity => !!entity && entity.id !== anchor?.id);
      for (const entity of counterparts) {
        const relevant = patterns.filter((pattern) => resourceFocus ? pattern.actorSelectorId === entity.id : pattern.targetSelectorId === entity.id);
        const node = entityNode(entity, resourceFocus ? "actor" : "resource", relevant);
        if (anchorNode) accessEdge(resourceFocus ? node : anchorNode, resourceFocus ? anchorNode : node, relevant);
      }
    }
    const scenario = scenarioId ? model.scenarios.find((scenario) => scenario.id === scenarioId) : undefined;
    return { id, scenarioId, label: scenario ? `${scenario.label} (${scenario.kind})` : null,
      mode: focused ? "paths" : "fan", anchorId: anchorNode?.instanceId ?? null, nodes, edges };
  }
  // Never silently substitute a hypothetical default for observed current access.
  const scenarioIds = selectedPattern ? navigation.scenarioIds.filter((id) => model.scenarioSpaces
    .find((space) => space.id === selectedPattern.scenarioSpaceId)?.scenarioIds.includes(id)) : [];
  const panels = scenarioIds.length ? scenarioIds.map(panel) : [panel(null)];
  const messages = !panels.some((panel) => panel.nodes.length) ? ["No actors or resources were identified in this analysis."] : [];
  if (navigation.scenarioIds.length && !scenarioIds.length) messages.push("Select an access action to display its scenarios.");
  return { panels, messages };
}
