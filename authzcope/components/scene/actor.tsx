"use client";

import { AnchoredLabel } from "./anchored-label";
import { sceneColors, type ScenePoint } from "./scene-types";

export function Actor({ id, instanceId, label, position }: { id: string; instanceId?: string; label: string; position: ScenePoint }) {
  return (
    <group position={position} name={instanceId ?? id} userData={{ semanticId: id, instanceId, kind: "actor" }}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.19, 0.4, 6, 16]} />
        <meshStandardMaterial color={sceneColors.actor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow>
        <sphereGeometry args={[0.23, 24, 16]} />
        <meshStandardMaterial color={sceneColors.actor} roughness={0.9} />
      </mesh>
      <AnchoredLabel id={id} label={label} position={[0, -0.18, 0.15]} />
    </group>
  );
}
