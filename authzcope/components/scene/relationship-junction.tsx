"use client";

import { AnchoredLabel } from "./anchored-label";
import { sceneColors, type ScenePoint } from "./scene-types";

export function RelationshipJunction({ id, label, position, active = true }: {
  id: string; label: string; position: ScenePoint; active?: boolean;
}) {
  return (
    <group position={position} name={id} userData={{ semanticId: id, kind: "relationship", active }}>
      <mesh>
        <sphereGeometry args={[0.12, 20, 12]} />
        <meshStandardMaterial color={active ? sceneColors.actor : sceneColors.none} roughness={0.9} />
      </mesh>
      <AnchoredLabel id={id} label={label} position={[0, 0.38, 0]} tone={active ? "default" : "muted"} />
    </group>
  );
}
