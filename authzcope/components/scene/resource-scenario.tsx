"use client";

import { Actor } from "./actor";
import { AnchoredLabel } from "./anchored-label";
import { Connection } from "./connection";
import { Resource, resourceConnectionAnchor } from "./resource";
import type { AccessComplexity, AccessLevel, ScenePoint } from "./scene-types";

const resourcePosition: ScenePoint = [0, 1.35, -0.8];
const origin: ScenePoint = [0, 0.9, 1.5];
const endpoint = resourceConnectionAnchor(resourcePosition);

// Each instance keeps the same local pose and semantic resource ID.
export function ResourceScenario({ resourceId, resourceLabel, complexity, actorId, actorLabel,
  scenarioId, scenarioLabel, access, summary, position }: {
  resourceId: string;
  resourceLabel: string;
  complexity: AccessComplexity;
  actorId: string;
  actorLabel: string;
  scenarioId: string;
  scenarioLabel: string;
  access: AccessLevel;
  summary: string;
  position: ScenePoint;
}) {
  return (
    <group position={position} name={scenarioId} userData={{ semanticId: resourceId, scenarioId }}>
      <AnchoredLabel id={scenarioId} label={scenarioLabel} position={[0, 2.6, -0.8]} />
      <Resource id={resourceId} instanceId={`${scenarioId}:resource`} label={resourceLabel}
        position={resourcePosition} complexity={complexity} />
      <Actor id={actorId} instanceId={`${scenarioId}:actor`} label={actorLabel} position={[0, 0, 1.5]} />
      <Connection id={`${scenarioId}:access`} from={origin} to={endpoint} access={access} scope="resource-summary" lift={0.15} />
      <AnchoredLabel id={`${scenarioId}:summary`} label={summary} position={[0, -0.5, 1.5]} />
    </group>
  );
}
