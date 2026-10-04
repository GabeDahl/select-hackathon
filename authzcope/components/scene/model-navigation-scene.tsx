"use client";

import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { AuthorizationModel } from "@/lib/authorization-model-types";
import type { ExplorerNavigation, NavigationTarget } from "@/lib/explorer-navigation-types";
import { createModelNavigationRegistry } from "@/lib/explorer-navigation";
import { Actor } from "./actor";
import { Resource, resourceConnectionAnchor } from "./resource";
import { Connection } from "./connection";
import { RelationshipJunction } from "./relationship-junction";
import { ResourceScenario } from "./resource-scenario";
import type { AccessComplexity, ScenePoint } from "./scene-types";

const actorPosition: ScenePoint = [0, 0, 2.4];
const origin: ScenePoint = [0, 1, 2.4];
const focusedPosition: ScenePoint = [0, 1.6, -2];

function ModelCamera({ span, perspective }: { span: number; perspective: ExplorerNavigation["perspective"] }) {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const distance = Math.max(9, span / Math.max(aspect, 0.25));
    camera.position.set(0, 1.1 + distance * (perspective === "user" ? 0.28 : 0.42), distance);
    camera.lookAt(0, 1.1, 0); camera.updateProjectionMatrix(); invalidate();
  }, [camera, aspect, invalidate, span, perspective]);
  return null;
}

/** Small symbolic adapter. All geometry is local; all access facts come from the model. */
export function ModelNavigationScene({ model, navigation, onInspect }: {
  model: AuthorizationModel; navigation: ExplorerNavigation; onInspect: (target: NavigationTarget) => void;
}) {
  const registry = useMemo(() => createModelNavigationRegistry(model), [model]);
  const entry = registry.entries.find((entry) => entry.target.kind === navigation.focus?.kind && entry.target.id === navigation.focus.id);
  const selectedPattern = model.accessPatterns.find((pattern) => pattern.id === navigation.patternId);
  const candidates = selectedPattern ? [selectedPattern] : entry?.patternIds.length
    ? model.accessPatterns.filter((pattern) => entry.patternIds.includes(pattern.id)) : model.accessPatterns;
  const defaultActor = model.presentation.perspectives.find((perspective) => perspective.id === model.presentation.defaultPerspectiveId)?.anchorSelectorId;
  const actorId = selectedPattern?.actorSelectorId ?? candidates[0]?.actorSelectorId ?? defaultActor;
  // Keep every displayed connection tied to the actor actually drawn in this scene.
  const actorPatterns = candidates.filter((pattern) => pattern.actorSelectorId === actorId);
  const focusResourceId = selectedPattern?.targetSelectorId ?? actorPatterns[0]?.targetSelectorId;
  const relevant = navigation.view !== "overview" && navigation.perspective === "resource"
    ? actorPatterns.filter((pattern) => pattern.targetSelectorId === focusResourceId) : actorPatterns;
  const actor = model.selectors.find((selector) => selector.id === actorId);
  const complexity = (patterns: typeof relevant): AccessComplexity => patterns.some((pattern) => pattern.classification === "unknown" || pattern.completeness !== "complete") ? "unresolved"
    : patterns.some((pattern) => pattern.classification === "conditional") ? "conditional" : "straightforward";
  const resources = [...new Set(relevant.map((pattern) => pattern.targetSelectorId))].slice(0, 24).map((id) => ({
    selector: model.selectors.find((selector) => selector.id === id)!, patterns: relevant.filter((pattern) => pattern.targetSelectorId === id),
  }));
  const highlightIds = new Set(navigation.highlighted.map((target) => target.id));
  const focused = navigation.view !== "overview" && navigation.perspective === "resource";
  const resource = selectedPattern ? model.selectors.find((selector) => selector.id === selectedPattern.targetSelectorId) : resources[0]?.selector;
  const paths = relevant.flatMap((pattern) => pattern.pathIds).filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 12)
    .map((id) => model.accessPaths.find((path) => path.id === id)!);
  const span = navigation.scenarioIds.length > 1 ? navigation.scenarioIds.length * 3 : focused ? Math.max(8, paths.length * 1.8) : 13;
  return <>
    <ModelCamera span={span} perspective={navigation.perspective} />
    <ambientLight intensity={0.65} />
    <hemisphereLight args={["#f4eee4", "#5c686d", 1.3]} />
    <directionalLight position={[-4, 8, 5]} intensity={2.5} color="#fff4df" />
    {navigation.scenarioIds.length && selectedPattern && resource && actor ? navigation.scenarioIds.map((id, index) => {
      const scenario = model.scenarios.find((scenario) => scenario.id === id)!;
      const evaluation = selectedPattern.evaluations.find((evaluation) => evaluation.scenarioId === id);
      const outcome = evaluation?.implemented.outcome ?? "unknown";
      return <ResourceScenario key={id} resourceId={resource.id} resourceLabel={resource.label} complexity={complexity([selectedPattern])}
        actorId={actor.id} actorLabel={actor.label} scenarioId={id} scenarioLabel={scenario.label}
        access={outcome === "allowed" ? "full" : outcome === "denied" ? "none" : "unknown"}
        summary={`${model.actions.find((action) => action.id === selectedPattern.actionId)?.label ?? "Action"}: ${outcome} (symbolic)`}
        position={[(index - (navigation.scenarioIds.length - 1) / 2) * 3, 0, 0]} />;
    }) : focused && resource ? <>
      <Resource id={resource.id} label={resource.label} position={focusedPosition} complexity={complexity(relevant)} selected />
      {actor ? <Actor id={actor.id} label={actor.label} position={actorPosition} /> : null}
      {paths.map((path, index) => {
        const position: ScenePoint = [(index - (paths.length - 1) / 2) * 1.8, 1.1, 0];
        const highlighted = highlightIds.has(path.id) || highlightIds.has(path.ruleId) || highlightIds.has(path.eligibilityConditionId) || path.relationshipTypeIds.some((id) => highlightIds.has(id));
        return <group key={path.id} onClick={(event) => { event.stopPropagation(); onInspect({ kind: "path", id: path.id }); }}>
          <RelationshipJunction id={path.id} label={path.label} position={position} />
          <Connection id={`${path.id}:actor`} from={origin} to={position} access="unknown" scope="symbolic-path" highlighted={highlighted} />
          <Connection id={path.id} from={position} to={resourceConnectionAnchor(focusedPosition)} access="unknown" scope="symbolic-path" highlighted={highlighted} />
        </group>;
      })}
    </> : <>
      {actor ? <Actor id={actor.id} label={actor.label} position={actorPosition} /> : null}
      {resources.map(({ selector, patterns }, index) => {
        const angle = resources.length === 1 ? 0 : (index / (resources.length - 1) - 0.5) * Math.PI * 1.35;
        const position: ScenePoint = [Math.sin(angle) * 4.7, 1.2, actorPosition[2] - Math.cos(angle) * 4.7];
        const rotationY = Math.atan2(-position[0], actorPosition[2] - position[2]);
        return <group key={selector.id}>
          <Resource id={selector.id} label={selector.label} position={position} rotationY={rotationY} complexity={complexity(patterns)}
            selected={highlightIds.has(selector.id) || navigation.focus?.id === selector.id}
            onInspect={(id) => onInspect({ kind: "selector", id })} />
          {actor ? <Connection id={`${selector.id}:access`} from={origin} to={resourceConnectionAnchor(position, rotationY)} access="unknown" scope="symbolic-overview" /> : null}
        </group>;
      })}
    </>}
  </>;
}
