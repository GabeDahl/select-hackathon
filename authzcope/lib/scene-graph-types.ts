import type { AuthorizationModel, Decision, EntityType, Pattern, Selector, TargetRef } from "./authorization-model-types.ts";

export type ScenePoint = [number, number, number];
export type SceneAccessLevel = "full" | "limited" | "none" | "unknown";
export type SceneComplexity = "straightforward" | "conditional" | "unresolved";

export type SemanticEntity = {
  id: string;
  target: TargetRef;
  label: string;
  entityType: EntityType;
  selector: Selector | null;
  refs: TargetRef[];
  patternIds: string[];
};

/** Application-owned indices over an already accepted authorization response. */
export type SemanticGraph = {
  model: AuthorizationModel;
  entities: Map<string, SemanticEntity>;
  patterns: Map<string, Pattern>;
  targetPatternIds: Map<string, string[]>;
  conditionRefs: Map<string, TargetRef[]>;
};

export type ScopedAccess = {
  patternId: string;
  actionId: string;
  scenarioId: string | null;
  scenarioKind: "symbolic" | "observed" | "hypothetical" | null;
  outcome: Decision["outcome"];
  method: Decision["method"] | null;
  pathStates: Decision["pathStates"];
  unresolvedConditionIds: string[];
};

export type SceneNode = {
  instanceId: string;
  semanticId: string;
  target: TargetRef;
  refs: TargetRef[];
  role: "actor" | "resource" | "path";
  label: string;
  materialization: "type" | "symbolic" | "observed_instance" | "explanation";
  complexity: SceneComplexity;
  highlighted: boolean;
  selected: boolean;
};

export type SceneEdge = {
  instanceId: string;
  fromId: string;
  toId: string;
  refs: TargetRef[];
  kind: "effective_access" | "path_explanation";
  actionIds: string[];
  access: SceneAccessLevel;
  evaluations: ScopedAccess[];
  highlighted: boolean;
};

export type ScenePanel = {
  id: string;
  scenarioId: string | null;
  label: string | null;
  mode: "fan" | "paths";
  anchorId: string | null;
  nodes: SceneNode[];
  edges: SceneEdge[];
};

export type SceneProjection = {
  panels: ScenePanel[];
  messages: string[];
};

export type PositionedNode = SceneNode & { position: ScenePoint; rotationY: number };
export type SceneLayout = {
  nodes: PositionedNode[];
  edges: SceneEdge[];
  labels: { id: string; label: string; position: ScenePoint }[];
  bounds: { min: ScenePoint; max: ScenePoint };
  /** One semantic target may appear in several panels, nodes, and edges. */
  instancesByTarget: Map<string, string[]>;
  positions: Map<string, { position: ScenePoint; rotationY: number }>;
  messages: string[];
};

export const semanticTargetKey = (ref: TargetRef) => JSON.stringify([ref.kind, ref.id]);
export function uniqueRefs(refs: TargetRef[]): TargetRef[] {
  return [...new Map(refs.map((ref) => [semanticTargetKey(ref), ref])).values()];
}
