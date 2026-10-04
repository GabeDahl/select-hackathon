"use client";

import { Line } from "@react-three/drei/core/Line";

import { AnchoredLabel } from "./anchored-label";
import { sceneColors, type SceneAction, type ScenePoint } from "./scene-types";

const sensitivityRing: ScenePoint[] = Array.from({ length: 49 }, (_, index) => {
  const angle = index / 48 * Math.PI * 2;
  return [Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0.03];
});

export function ActionPort({ action, position }: { action: SceneAction; position: ScenePoint }) {
  return (
    <group position={position} name={action.id} userData={{ semanticId: action.id, kind: "action", status: action.status }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.045, 24]} />
        <meshStandardMaterial color={sceneColors.ground} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <circleGeometry args={[0.078, 24]} />
        <meshBasicMaterial color={sceneColors[action.status]} toneMapped={false} />
      </mesh>
      {action.status === "blocked" ? (
        <Line points={[[-0.05, 0.05, 0.036], [0.05, -0.05, 0.036]]} color={sceneColors.resource} lineWidth={1.5} toneMapped={false} />
      ) : null}
      {action.status === "unknown" ? (
        <mesh position={[0, 0, 0.038]}>
          <ringGeometry args={[0.026, 0.037, 20]} />
          <meshBasicMaterial color={sceneColors.ground} />
        </mesh>
      ) : null}
      {action.scenarioSensitive ? (
        <Line points={sensitivityRing} color={sceneColors.selected} lineWidth={1} dashed dashSize={0.04} gapSize={0.035} toneMapped={false} />
      ) : null}
      <AnchoredLabel id={action.id} label={action.symbol} position={[0, 0.23, 0.025]} tone="surface" worldHeight={0.25} />
    </group>
  );
}
